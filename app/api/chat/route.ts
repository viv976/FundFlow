import { NextRequest, NextResponse } from 'next/server';
import { generateGroundedResponse } from '@/lib/ai/gemini-service';
import { Transaction, Workspace } from '@/types/finance';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DatabaseKnowledgeDocument, DatabaseDocumentChunk, DatabaseMonthlyFinancialSummary, DatabaseWorkspace } from '@/lib/supabase/types';

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

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message prompt is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // 1. Resolve Workspace
    let activeWs: Workspace = {
      id: workspaceId || 'default-workspace',
      name: 'Corporate Workspace',
      owner_id: 'default-owner',
      currency: 'USD',
      created_at: new Date().toISOString(),
    };

    if (workspaceId) {
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .limit(1)
        .single();

      if (wsData) {
        const dbWs = wsData as DatabaseWorkspace;
        activeWs = {
          id: dbWs.id,
          name: dbWs.name,
          owner_id: dbWs.owner_id,
          currency: dbWs.currency || 'USD',
          created_at: dbWs.created_at,
        };
      }
    }

    // 2. Fetch Workspace Knowledge Documents & Chunks for RAG
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

    // 3. Resolve or Create Conversation
    let activeConvId = conversationId;
    try {
      if (!activeConvId) {
        const { data: newConv } = await supabase
          .from('ai_conversations')
          .insert({
            workspace_id: activeWs.id,
            user_id: activeWs.owner_id,
            title: message.substring(0, 50),
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
          content: message,
          grounded: false,
        });
      }
    } catch (dbErr) {
      console.warn('Supabase message persistence notice:', dbErr);
    }

    // 4. Generate Grounded AI Response
    const aiResponse = await generateGroundedResponse(message, {
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
        currentQuestion: message,
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
    const msg = error instanceof Error ? error.message : 'Failed to process financial AI query';
    console.error('AI Chat endpoint error:', error);
    return NextResponse.json(
      { error: msg, requestId },
      { status: 500 }
    );
  }
}
