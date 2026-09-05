import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      fileName,
      fileSizeBytes = 0,
      rowsImported = 0,
      userId,
    } = body;

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'File name is required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Resolve user ID
    let targetUserId = userId;
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token) {
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user?.id) targetUserId = userData.user.id;
      }
    }

    if (!targetUserId) {
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();
      targetUserId = wsData?.owner_id || null;
    }

    // Multi-tenant check
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
          { success: false, error: 'Unauthorized: You do not have access to this workspace' },
          { status: 403 }
        );
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from('uploaded_files')
      .insert({
        workspace_id: workspaceId,
        file_name: fileName,
        file_type: 'text/csv',
        file_size_bytes: Number(fileSizeBytes) || 0,
        rows_imported: Number(rowsImported) || 0,
        status: 'completed',
        uploaded_by: targetUserId,
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('[API /api/files/record] DB error:', {
        message: insErr.message,
        code: insErr.code,
        details: insErr.details,
      });
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: inserted?.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error recording uploaded file';
    console.error('[API /api/files/record] Unhandled exception:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
