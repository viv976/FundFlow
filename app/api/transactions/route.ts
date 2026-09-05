import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DatabaseTransaction } from '@/lib/supabase/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, transaction, userId } = body;

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    if (!transaction || typeof transaction !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Transaction object is required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 1. Resolve target User ID
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
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();
      targetUserId = wsData?.owner_id || '2750de4a-7e18-4345-9d29-72385783cf2c';
    }

    // 2. Multi-tenant Authorization Check
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
        { success: false, error: 'Unauthorized: You do not have permission to add transactions to this workspace' },
        { status: 403 }
      );
    }

    // 3. Prepare Database Payload
    const dbPayload: Partial<DatabaseTransaction> = {
      workspace_id: workspaceId,
      transaction_date: String(transaction.transaction_date || new Date().toISOString().substring(0, 10)),
      amount: Math.abs(Number(transaction.amount) || 0),
      transaction_type: transaction.transaction_type === 'income' ? 'income' : 'expense',
      category: typeof transaction.category === 'string' && transaction.category.trim() ? transaction.category.trim() : 'Other',
      merchant: typeof transaction.merchant === 'string' && transaction.merchant.trim() ? transaction.merchant.trim() : null,
      description: typeof transaction.description === 'string' && transaction.description.trim() ? transaction.description.trim() : 'Manual Transaction',
      account_name: typeof transaction.account_name === 'string' ? transaction.account_name : transaction.external_reference || 'Operating Account',
      currency: typeof transaction.currency === 'string' && transaction.currency.trim() ? transaction.currency.trim() : 'USD',
      source: transaction.source === 'csv_import' || transaction.source === 'CSV' ? 'CSV' : 'Manual',
      is_recurring: false,
      created_by: targetUserId,
    };

    if (
      typeof transaction.id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transaction.id)
    ) {
      dbPayload.id = transaction.id;
    }

    const { data: inserted, error: insErr } = await supabase
      .from('transactions')
      .insert(dbPayload)
      .select()
      .single();

    if (insErr) {
      console.error('[API /api/transactions] DB insert error:', {
        message: insErr.message,
        code: insErr.code,
        details: insErr.details,
        hint: insErr.hint,
      });
      return NextResponse.json(
        { success: false, error: `Database error: ${insErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: inserted,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error creating transaction';
    console.error('[API /api/transactions] Unhandled exception:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
