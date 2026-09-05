import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DatabaseTransaction } from '@/lib/supabase/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      transactions,
      fileName = 'import.csv',
      fileSizeBytes = 0,
      userId,
    } = body;

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No transaction rows provided for import' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 1. Resolve User
    let targetUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;

    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token) {
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user?.id) {
          targetUserId = userData.user.id;
        }
      }
    }

    if (!targetUserId) {
      // Find workspace owner
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();
      if (wsData?.owner_id) {
        targetUserId = wsData.owner_id;
      } else {
        targetUserId = '2750de4a-7e18-4345-9d29-72385783cf2c';
      }
    }

    // 2. Multi-Tenant Authorization Check
    // Verify that targetUserId has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId)
      .limit(1);

    const { data: wsOwnerCheck } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    const isAuthorized =
      (membership && membership.length > 0) ||
      (wsOwnerCheck && wsOwnerCheck.owner_id === targetUserId);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not have permission to import into this workspace' },
        { status: 403 }
      );
    }

    // 3. Prepare Database Payloads
    const dbPayloads: Partial<DatabaseTransaction>[] = transactions.map((t: Record<string, unknown>) => {
      const payload: Partial<DatabaseTransaction> = {
        workspace_id: workspaceId,
        transaction_date: String(t.transaction_date || new Date().toISOString().substring(0, 10)),
        amount: Math.abs(Number(t.amount) || 0),
        transaction_type: t.transaction_type === 'income' ? 'income' : 'expense',
        category: typeof t.category === 'string' && t.category.trim() ? t.category.trim() : 'Uncategorized',
        merchant: typeof t.merchant === 'string' && t.merchant.trim() ? t.merchant.trim() : null,
        description: typeof t.description === 'string' && t.description.trim() ? t.description.trim() : 'Transaction',
        account_name: typeof t.external_reference === 'string' ? t.external_reference : 'Operating Account',
        currency: typeof t.currency === 'string' && t.currency.trim() ? t.currency.trim() : 'USD',
        source: 'CSV',
        is_recurring: false,
        created_by: targetUserId,
      };

      // Only pass id if it's a valid UUID
      if (typeof t.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t.id)) {
        payload.id = t.id;
      }

      return payload;
    });

    // 4. Chunked Bulk Insert for Performance & Safety
    const CHUNK_SIZE = 100;
    let totalInserted = 0;

    for (let i = 0; i < dbPayloads.length; i += CHUNK_SIZE) {
      const chunk = dbPayloads.slice(i, i + CHUNK_SIZE);
      const { data: inserted, error: insErr } = await supabase
        .from('transactions')
        .insert(chunk)
        .select('id');

      if (insErr) {
        console.error('Error inserting transaction chunk in DB:', insErr);
        return NextResponse.json(
          { success: false, error: `Database error inserting transactions: ${insErr.message}` },
          { status: 500 }
        );
      }

      totalInserted += inserted ? inserted.length : chunk.length;
    }

    // 5. Record file in uploaded_files
    try {
      await supabase.from('uploaded_files').insert({
        workspace_id: workspaceId,
        file_name: fileName,
        file_type: 'text/csv',
        file_size_bytes: fileSizeBytes,
        rows_imported: totalInserted,
        status: 'completed',
        uploaded_by: targetUserId,
      });
    } catch (uploadLogErr) {
      console.warn('Non-fatal upload log note:', uploadLogErr);
    }

    return NextResponse.json({
      success: true,
      importedCount: totalInserted,
      workspaceId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error processing transaction import';
    console.error('Unhandled exception in POST /api/transactions/bulk:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
