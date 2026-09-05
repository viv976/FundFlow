import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { workspaceId, updates, userId } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Transaction ID is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Verify workspace authorization if workspaceId provided
    if (workspaceId) {
      let targetUserId = userId;
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        if (token) {
          const { data: userData } = await supabase.auth.getUser(token);
          if (userData?.user?.id) targetUserId = userData.user.id;
        }
      }

      if (targetUserId) {
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
          return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }
      }
    }

    const dbPayload: Record<string, unknown> = {};
    if (updates.transaction_date) dbPayload.transaction_date = updates.transaction_date;
    if (updates.description !== undefined) dbPayload.description = updates.description;
    if (updates.merchant !== undefined) dbPayload.merchant = updates.merchant;
    if (updates.category !== undefined) dbPayload.category = updates.category;
    if (updates.amount !== undefined) dbPayload.amount = Math.abs(Number(updates.amount));
    if (updates.transaction_type) dbPayload.transaction_type = updates.transaction_type;
    if (updates.currency) dbPayload.currency = updates.currency;
    dbPayload.updated_at = new Date().toISOString();

    const { error } = await supabase.from('transactions').update(dbPayload).eq('id', id);

    if (error) {
      console.error('[API /api/transactions/:id PATCH] Error:', {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error updating transaction';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Transaction ID is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from('transactions').delete().eq('id', id);

    if (error) {
      console.error('[API /api/transactions/:id DELETE] Error:', {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error deleting transaction';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
