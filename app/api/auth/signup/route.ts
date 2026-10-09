import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateSignupInput } from '@/lib/validation';
import { getUserSafeErrorMessage } from '@/lib/errors';
import { DatabaseWorkspace } from '@/lib/supabase/types';

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
    const validation = validateSignupInput(body);

    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0].message, details: validation.errors },
        { status: 400 }
      );
    }

    const { fullName, companyName, email, password } = validation.data;

    // Determine redirect origin for email confirmation links
    const origin = req.headers.get('origin') || req.nextUrl.origin || 'http://localhost:3000';
    const emailRedirectTo = `${origin}/auth/callback`;

    // 1. Create real Supabase Auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
          job_title: 'Founder & CEO',
        },
        emailRedirectTo,
      },
    });

    // 2. Handle existing account detection
    if (authErr) {
      const errLower = authErr.message.toLowerCase();
      if (
        errLower.includes('already registered') ||
        errLower.includes('already exists') ||
        authErr.status === 422
      ) {
        return NextResponse.json(
          {
            success: false,
            code: 'USER_ALREADY_EXISTS',
            error: 'An account with this email already exists. Please log in instead.',
          },
          { status: 409 }
        );
      }

      if (errLower.includes('rate limit')) {
        return NextResponse.json(
          {
            success: false,
            code: 'RATE_LIMITED',
            error: 'Email delivery rate limit reached. Please wait a few moments before trying again.',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: getUserSafeErrorMessage(authErr, 'Failed to create account. Please check your credentials.'),
        },
        { status: 400 }
      );
    }

    // Supabase returns identities: [] when email confirmation is enabled and the user already exists
    if (
      authData?.user &&
      Array.isArray(authData.user.identities) &&
      authData.user.identities.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          code: 'USER_ALREADY_EXISTS',
          error: 'An account with this email already exists. Please log in instead.',
        },
        { status: 409 }
      );
    }

    const newUser = authData?.user;
    if (!newUser) {
      return NextResponse.json(
        { success: false, error: 'Could not create user account. Please try again.' },
        { status: 500 }
      );
    }

    const userId = newUser.id;
    const adminSupabase = createServerSupabaseClient();

    // 3. Upsert user profile
    await adminSupabase.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      email: email,
      job_title: 'Founder & CEO',
      updated_at: new Date().toISOString(),
    });

    // 4. Provision initial real workspace (Idempotent: check if workspace already exists)
    let createdWorkspace: DatabaseWorkspace;
    const { data: existingWorkspaces } = await adminSupabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', userId)
      .limit(1);

    if (existingWorkspaces && existingWorkspaces.length > 0) {
      createdWorkspace = existingWorkspaces[0] as DatabaseWorkspace;
    } else {
      // Generate clean unique slug
      let baseSlug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      if (!baseSlug) baseSlug = 'workspace';

      let slug = baseSlug;
      const { data: existingSlug } = await adminSupabase
        .from('workspaces')
        .select('id')
        .eq('slug', slug)
        .limit(1);

      if (existingSlug && existingSlug.length > 0) {
        slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }

      // Insert clean real workspace with 0 starting cash and ZERO fake transactions
      const { data: wsData, error: wsErr } = await adminSupabase
        .from('workspaces')
        .insert({
          name: companyName,
          slug,
          owner_id: userId,
          currency: 'USD',
          starting_cash: 0,
          alert_runway_threshold: 6,
        })
        .select()
        .single();

      if (wsErr || !wsData) {
        console.error('Error creating workspace record during signup:', wsErr);
        return NextResponse.json(
          { success: false, error: 'Account created, but failed to provision initial workspace.' },
          { status: 500 }
        );
      }

      createdWorkspace = wsData as DatabaseWorkspace;
    }

    // 5. Ensure Owner Membership record exists in workspace_members
    await adminSupabase.from('workspace_members').upsert(
      {
        workspace_id: createdWorkspace.id,
        user_id: userId,
        role: 'owner',
      },
      { onConflict: 'workspace_id,user_id' }
    );

    // 6. Provision Default Categories for the new workspace
    try {
      const { data: existingCats } = await adminSupabase
        .from('transaction_categories')
        .select('id')
        .eq('workspace_id', createdWorkspace.id)
        .limit(1);

      if (!existingCats || existingCats.length === 0) {
        await adminSupabase.from('transaction_categories').insert(
          DEFAULT_CATEGORIES.map((cat) => ({
            workspace_id: createdWorkspace.id,
            ...cat,
          }))
        );
      }
    } catch (catErr) {
      console.warn('Non-fatal note initializing transaction categories:', catErr);
    }

    // 7. Provision Default Alert Preferences
    try {
      await adminSupabase.from('alert_preferences').upsert(
        {
          workspace_id: createdWorkspace.id,
          runway_threshold_months: 6.0,
          expense_spike_percentage: 40.0,
          cash_minimum_threshold: 50000.0,
          large_transaction_threshold: 10000.0,
          email_notifications_enabled: true,
          slack_notifications_enabled: false,
        },
        { onConflict: 'workspace_id' }
      );
    } catch (prefErr) {
      console.warn('Non-fatal note initializing alert preferences:', prefErr);
    }

    // 8. Return response respecting Supabase email confirmation configuration
    const hasActiveSession = Boolean(authData.session);

    return NextResponse.json(
      {
        success: true,
        userId,
        email,
        companyName,
        workspaceId: createdWorkspace.id,
        workspace: createdWorkspace,
        requiresEmailConfirmation: !hasActiveSession,
        session: authData.session || null,
        message: !hasActiveSession
          ? `A verification email has been sent to ${email}. Please check your inbox and verify your email before signing in.`
          : 'Account and business workspace successfully created.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Unhandled error in POST /api/auth/signup:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error processing account creation.' },
      { status: 500 }
    );
  }
}
