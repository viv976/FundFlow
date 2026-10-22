import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function handleDeleteAccount(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // 1. Authenticate user strictly from Bearer token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: invalid bearer token' },
        { status: 401 }
      );
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: invalid or expired session' },
        { status: 401 }
      );
    }

    const targetUserId = userData.user.id;

    // 2. Identify workspaces owned by this user
    const { data: ownedWorkspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', targetUserId);

    const ownedWorkspaceIds = (ownedWorkspaces || []).map((w: { id: string }) => w.id);

    // 3. Remove user memberships from all workspaces (both shared and owned)
    await supabase
      .from('workspace_members')
      .delete()
      .eq('user_id', targetUserId);

    // 4. Delete workspaces owned by this user (cascades transactions, alerts, preferences, etc.)
    if (ownedWorkspaceIds.length > 0) {
      await supabase
        .from('workspaces')
        .delete()
        .in('id', ownedWorkspaceIds);
    }

    // 5. Delete profile record
    await supabase
      .from('profiles')
      .delete()
      .eq('id', targetUserId);

    // 6. Delete user from auth.users if admin API is available
    if (typeof supabase.auth?.admin?.deleteUser === 'function') {
      const { error: adminAuthErr } = await supabase.auth.admin.deleteUser(targetUserId);
      if (adminAuthErr) {
        console.warn('Notice: auth.admin.deleteUser returned error:', adminAuthErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Account permanently deleted',
    });
  } catch (err: unknown) {
    console.error('Delete account server error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete account. Please try again.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleDeleteAccount(req);
}

export async function DELETE(req: NextRequest) {
  return handleDeleteAccount(req);
}
