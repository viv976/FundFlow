import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
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

/**
 * Extracts a 3-letter currency code (e.g. "Indian Rupee (INR)" -> "INR", "USD" -> "USD")
 */
function sanitizeCurrencyCode(input?: string): string {
  if (!input || typeof input !== 'string') return 'USD';
  const match = input.match(/\b([A-Z]{3})\b/i);
  if (match) return match[1].toUpperCase();
  const trimmed = input.trim().toUpperCase();
  return trimmed.length === 3 ? trimmed : 'USD';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      name,
      currency = 'USD',
      startingCash = 500000,
      alertRunwayThreshold = 6,
      userId,
    } = body;

    // 1. Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Business / Company Legal Name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const cleanCurrency = sanitizeCurrencyCode(currency);
    const numCash = typeof startingCash === 'number' ? startingCash : parseFloat(String(startingCash)) || 0;
    const numThreshold = typeof alertRunwayThreshold === 'number' ? alertRunwayThreshold : parseFloat(String(alertRunwayThreshold)) || 6;

    if (numCash < 0) {
      return NextResponse.json(
        { success: false, error: 'Initial cash balance cannot be negative' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 2. Resolve User ID
    let targetUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;

    if (!targetUserId) {
      // Check if authenticated in Supabase via header
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
    }

    // If still no user, find the primary profile or fallback to demo founder
    if (!targetUserId) {
      const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
      if (profiles && profiles.length > 0) {
        targetUserId = profiles[0].id;
      } else {
        targetUserId = '2750de4a-7e18-4345-9d29-72385783cf2c';
      }
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

    // 7. Insert Initial Opening Cash Transaction if starting cash provided
    if (numCash > 0) {
      try {
        await supabase.from('transactions').insert({
          workspace_id: createdWorkspace.id,
          transaction_date: new Date().toISOString().substring(0, 10),
          amount: numCash,
          transaction_type: 'income',
          category: 'Customer Revenue',
          merchant: 'Initial Liquid Capital',
          description: 'Opening Cash Reserve',
          account_name: 'Primary Operating Treasury',
          currency: cleanCurrency,
          source: 'manual',
          is_recurring: false,
          status: 'completed',
        });
      } catch (txErr) {
        console.warn('Non-fatal note creating initial cash transaction:', txErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        workspace: createdWorkspace,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error creating workspace';
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
