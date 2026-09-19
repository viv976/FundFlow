import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DatabaseTransaction } from '@/lib/supabase/types';
import { isValidUUID, validateTransactionInput } from '@/lib/validation';
import { getUserSafeErrorMessage } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, transaction, userId } = body;

    if (!isValidUUID(workspaceId)) {
      return NextResponse.json(
        { success: false, error: 'A valid Workspace UUID is required' },
        { status: 400 }
      );
    }

    const validation = validateTransactionInput(transaction);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.errors[0].message,
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const validTx = validation.data;

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
      transaction_date: validTx.transaction_date,
      amount: validTx.amount,
      transaction_type: validTx.transaction_type,
      category: validTx.category,
      merchant: validTx.merchant || null,
      description: validTx.description,
      account_name: validTx.external_reference || 'Operating Account',
      currency: validTx.currency,
      source: validTx.source === 'csv_import' ? 'CSV' : 'Manual',
      status: validTx.status,
      is_recurring: false,
      created_by: targetUserId,
    };

    if (isValidUUID(transaction.id)) {
      dbPayload.id = transaction.id;
    }

    let inserted: DatabaseTransaction | null = null;
    const { data: insData, error: insErr } = await supabase
      .from('transactions')
      .insert(dbPayload)
      .select()
      .single();

    if (insErr) {
      // Check if remote schema cache is missing the 'status' column (PGRST204)
      if (insErr.code === 'PGRST204' || insErr.message?.includes("'status' column")) {
        const fallbackPayload = { ...dbPayload };
        delete fallbackPayload.status;
        if (validTx.status && validTx.status !== 'completed') {
          const baseAcc = validTx.external_reference || 'Operating Account';
          fallbackPayload.account_name = `${baseAcc} [status:${validTx.status}]`;
        }
        const { data: retryData, error: retryErr } = await supabase
          .from('transactions')
          .insert(fallbackPayload)
          .select()
          .single();

        if (retryErr) {
          console.error('[API /api/transactions] DB insert retry error:', {
            message: retryErr.message,
            code: retryErr.code,
            details: retryErr.details,
            hint: retryErr.hint,
          });
          return NextResponse.json(
            { success: false, error: `Database error: ${retryErr.message}` },
            { status: 500 }
          );
        }
        inserted = retryData ? ({ ...retryData, status: validTx.status } as DatabaseTransaction) : null;
      } else {
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
    } else {
      inserted = insData as DatabaseTransaction;
    }

    return NextResponse.json({
      success: true,
      transaction: inserted,
    });
  } catch (err: unknown) {
    const msg = getUserSafeErrorMessage(err, 'Internal error creating transaction');
    console.error('[API /api/transactions] Unhandled exception:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
