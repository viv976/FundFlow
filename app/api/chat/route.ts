import { NextRequest, NextResponse } from 'next/server';
import { generateGroundedResponse } from '@/lib/ai/gemini-service';
import { Transaction, Workspace } from '@/types/finance';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DatabaseKnowledgeDocument, DatabaseDocumentChunk, DatabaseMonthlyFinancialSummary, DatabaseWorkspace } from '@/lib/supabase/types';
import { validateChatInput, isValidUUID } from '@/lib/validation';
import { getUserSafeErrorMessage } from '@/lib/errors';

export async function POST(req: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    const body = await req.json();
    const { message, transactions, workspaceId, conversationId } = body as {
      message: string;
      transactions?: Transaction[];
      workspaceId?: string;
      conversationId?: string;
    };

    const promptValidation = validateChatInput(message);
    if (!promptValidation.isValid) {
      return NextResponse.json(
        { error: promptValidation.errors[0].message, details: promptValidation.errors },
        { status: 400 }
      );
    }
    const cleanMessage = promptValidation.data;

    const supabase = createServerSupabaseClient();

    // 1. Authentication Check: Extract Bearer token & resolve user
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required. Missing or malformed Authorization header.', requestId },
        { status: 401 }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required. Missing bearer token.', requestId },
        { status: 401 }
      );
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return NextResponse.json(
        { error: 'Invalid or expired authentication session.', requestId },
        { status: 401 }
      );
    }
    const authenticatedUserId = userData.user.id;

    // 2. Validate workspaceId
    if (!workspaceId || !isValidUUID(workspaceId)) {
      return NextResponse.json(
        { error: 'A valid Workspace UUID is required.', requestId },
        { status: 400 }
      );
    }

    // 3. Multi-tenant Authorization Check
    const { data: wsData, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .limit(1)
      .single();

    if (wsError || !wsData) {
      return NextResponse.json(
        { error: 'Workspace not found.', requestId },
        { status: 404 }
      );
    }

    const isOwner = wsData.owner_id === authenticatedUserId;

    let isMember = false;
    if (!isOwner) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', authenticatedUserId)
        .limit(1);

      isMember = Boolean(membership && membership.length > 0);
    }

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this workspace.', requestId },
        { status: 403 }
      );
    }

    const dbWs = wsData as DatabaseWorkspace;
    const activeWs: Workspace = {
      id: dbWs.id,
      name: dbWs.name,
      owner_id: dbWs.owner_id,
      currency: dbWs.currency || 'USD',
      created_at: dbWs.created_at,
    };

    // 4. Fetch Workspace Knowledge Documents & Chunks for RAG (Authorized Tenant)
    let knowledgeDocs: DatabaseKnowledgeDocument[] = [];
    let documentChunks: DatabaseDocumentChunk[] = [];
    let monthlySummaries: DatabaseMonthlyFinancialSummary[] = [];

    try {
      const [docsRes, chunksRes, sumRes] = await Promise.all([
        supabase.from('knowledge_documents').select('*').eq('workspace_id', activeWs.id),
        supabase.from('document_chunks').select('*').eq('workspace_id', activeWs.id),
        supabase.from('monthly_financial_summary').select('*').eq('workspace_id', activeWs.id),
      ]);

      if (docsRes.data) knowledgeDocs = docsRes.data as DatabaseKnowledgeDocument[];
      if (chunksRes.data) documentChunks = chunksRes.data as DatabaseDocumentChunk[];
      if (sumRes.data) monthlySummaries = sumRes.data as DatabaseMonthlyFinancialSummary[];
    } catch (fetchErr) {
      console.warn('RAG workspace data load notice:', fetchErr);
    }

    // 5. Resolve or Create Conversation
    let activeConvId = conversationId;
    try {
      if (!activeConvId) {
        const { data: newConv } = await supabase
          .from('ai_conversations')
          .insert({
            workspace_id: activeWs.id,
            user_id: authenticatedUserId,
            title: cleanMessage.substring(0, 50),
          })
          .select('id')
          .single();

        activeConvId = newConv?.id;
      }

      // Record User Message
      if (activeConvId) {
        await supabase.from('ai_messages').insert({
          conversation_id: activeConvId,
          role: 'user',
          content: cleanMessage,
          grounded: false,
        });
      }
    } catch (dbErr) {
      console.warn('Supabase message persistence notice:', dbErr);
    }

    // 4. Generate Grounded AI Response
    const aiResponse = await generateGroundedResponse(cleanMessage, {
      workspace: activeWs,
      transactions: transactions || [],
      monthlySummaries,
      knowledgeDocs,
      documentChunks,
    });

    // 5. Internal Debug / Audit Logging (without credentials)
    console.log(
      JSON.stringify({
        requestId,
        workspaceId: activeWs.id,
        currentQuestion: cleanMessage,
        detectedIntent: aiResponse.detectedIntent,
        groundingConfidence: aiResponse.groundingConfidence,
        retrievedChunkIds: aiResponse.retrievedChunkIds || [],
        databaseQueriesUsed: aiResponse.databaseQueriesUsed || [],
      })
    );

    // 6. Record Assistant Message in Supabase
    try {
      if (activeConvId) {
        await supabase.from('ai_messages').insert({
          conversation_id: activeConvId,
          role: 'assistant',
          content: aiResponse.content,
          grounded: aiResponse.grounded,
        });
      }
    } catch (dbErr) {
      console.warn('Supabase assistant message persistence notice:', dbErr);
    }

    return NextResponse.json({
      ...aiResponse,
      requestId,
      conversationId: activeConvId,
    });
  } catch (error: unknown) {
    const msg = getUserSafeErrorMessage(error, 'Failed to process financial AI query');
    console.error('AI Chat endpoint error:', error);
    return NextResponse.json(
      { error: msg, requestId },
      { status: 500 }
    );
  }
}
