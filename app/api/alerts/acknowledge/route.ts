import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { alertId, workspaceId, all = false, userId } = body;

    if (!alertId && !workspaceId) {
      return NextResponse.json(
        { success: false, error: 'Either alertId or workspaceId is required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Verify workspace authorization if workspaceId is provided
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
          return NextResponse.json(
            { success: false, error: 'Unauthorized: You do not have permission to manage alerts for this workspace' },
            { status: 403 }
          );
        }
      }
    }

    if (all && workspaceId) {
      const { data, error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('workspace_id', workspaceId)
        .select();

      if (error) {
        console.error('[API /api/alerts/acknowledge] DB error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, updatedCount: data?.length || 0 });
    } else if (alertId) {
      const isUuid =
        typeof alertId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(alertId);

      if (isUuid) {
        let query = supabase.from('alerts').update({ is_read: true }).eq('id', alertId);
        if (workspaceId) {
          query = query.eq('workspace_id', workspaceId);
        }
        const { data, error } = await query.select();

        if (error) {
          console.error('[API /api/alerts/acknowledge] DB error:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            alertId,
            workspaceId,
          });
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, updatedCount: data?.length || 0 });
      } else {
        // If non-UUID ID was passed (e.g. from dynamic client state), attempt to acknowledge matching workspace alert or return success
        if (workspaceId) {
          const { data } = await supabase
            .from('alerts')
            .update({ is_read: true })
            .eq('workspace_id', workspaceId)
            .eq('is_read', false)
            .limit(1)
            .select();

          return NextResponse.json({ success: true, updatedCount: data?.length || 0 });
        }
        return NextResponse.json({ success: true, updatedCount: 0 });
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error acknowledging alert';
    console.error('[API /api/alerts/acknowledge] Unhandled exception:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
