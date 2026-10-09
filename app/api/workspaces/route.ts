import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DatabaseWorkspace } from '@/lib/supabase/types';
import { validateWorkspaceInput } from '@/lib/validation';
import { getUserSafeErrorMessage } from '@/lib/errors';

const DEFAULT_CATEGORIES = [
  { name: 'Customer Revenue', category_type: 'revenue', description: 'Customer and subscription revenue' },
  { name: 'Payroll', category_type: 'expense', description: 'Employee salaries and payroll' },
  { name: 'Cloud Infrastructure', category_type: 'expense', description: 'AWS, cloud hosting and infrastructure' },
  { name: 'SaaS & Software', category_type: 'expense', description: 'Software and SaaS subscriptions' },
  { name: 'Marketing', category_type: 'expense', description: 'Advertising and marketing' },
  { name: 'Rent & Office', category_type: 'expense', description: 'Office rent and facilities' },
  { name: 'Contractors', category_type: 'expense', description: 'Freelancers and contractors' },
  { name: 'Legal & Professional', category_type: 'expense', description: 'Legal, accounting and professional services' },
  { name: 'Travel', category_type: 'expense', description: 'Business travel' },
  { name: 'Other', category_type: 'expense', description: 'Other operating expenses' },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const validation = validateWorkspaceInput(body);

    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0].message, details: validation.errors },
        { status: 400 }
      );
    }

    const {
      name: trimmedName,
      currency: cleanCurrency,
      startingCash: numCash,
      alertRunwayThreshold: numThreshold,
      userId,
    } = validation.data;

    const supabase = createServerSupabaseClient();

    // 2. Resolve User ID securely from authenticated session token
    let targetUserId: string | null = null;
    const authHeader = req.headers.get('authorization');

    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token) {
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userData?.user?.id) {
          targetUserId = userData.user.id;
        } else if (userErr) {
          return NextResponse.json(
            { success: false, error: 'Invalid or expired authentication session' },
            { status: 401 }
          );
        }
      }
    }

    // If body specifies a userId, it must match the authenticated token (if present)
    if (typeof userId === 'string' && userId.trim()) {
      if (targetUserId && targetUserId !== userId.trim()) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: cannot create workspace on behalf of another user' },
          { status: 403 }
        );
      }
      if (!targetUserId) {
        targetUserId = userId.trim();
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to create a workspace' },
        { status: 401 }
      );
    }

    // Verify user profile exists in profiles table before inserting workspace
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .limit(1)
      .single();

    if (!existingProfile) {
      // Create user profile if it doesn't exist
      await supabase.from('profiles').upsert({
        id: targetUserId,
        full_name: 'Alex Rivera',
        email: 'alex.rivera@demo.fundflow.app',
        job_title: 'Founder & CEO',
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Generate unique slug
    let baseSlug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = 'workspace';

    let slug = baseSlug;
    const { data: existingSlug } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .limit(1);

    if (existingSlug && existingSlug.length > 0) {
      slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // 4. Insert Workspace
    const { data: wsData, error: wsErr } = await supabase
      .from('workspaces')
      .insert({
        name: trimmedName,
        slug,
        owner_id: targetUserId,
        currency: cleanCurrency,
        starting_cash: numCash,
        alert_runway_threshold: numThreshold,
      })
      .select()
      .single();

    if (wsErr || !wsData) {
      console.error('Error creating workspace row in DB:', wsErr);
      return NextResponse.json(
        {
          success: false,
          error: wsErr?.message || 'Failed to create workspace record in database',
        },
        { status: 500 }
      );
    }

    const createdWorkspace = wsData as DatabaseWorkspace;

    // 5. Insert Workspace Member (Owner)
    const { error: memErr } = await supabase.from('workspace_members').insert({
      workspace_id: createdWorkspace.id,
      user_id: targetUserId,
      role: 'owner',
    });

    if (memErr) {
      console.error('Error adding owner to workspace_members, rolling back workspace:', memErr);
      // Rollback workspace creation to prevent orphaned record
      await supabase.from('workspaces').delete().eq('id', createdWorkspace.id);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to assign workspace membership: ${memErr.message}`,
        },
        { status: 500 }
      );
    }

    // 6. Insert Default Transaction Categories
    try {
      await supabase.from('transaction_categories').insert(
        DEFAULT_CATEGORIES.map((cat) => ({
          workspace_id: createdWorkspace.id,
          ...cat,
        }))
      );
    } catch (catErr) {
      console.warn('Non-fatal note inserting default categories:', catErr);
    }

    return NextResponse.json(
      {
        success: true,
        workspace: createdWorkspace,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = getUserSafeErrorMessage(err, 'Internal server error creating workspace');
    console.error('Unhandled exception in POST /api/workspaces:', err);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
