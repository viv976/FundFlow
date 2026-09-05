import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName = 'Founder', phone = '' } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address (e.g. Gmail or work email) is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = typeof fullName === 'string' && fullName.trim() ? fullName.trim() : 'Founder';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';

    // 1. Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    let userId: string;

    if (existing) {
      userId = existing.id;
      // Update password and metadata if provided
      await supabase.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanFullName,
          phone: cleanPhone,
        },
      });
    } else {
      // Create new user with confirmed email
      const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanFullName,
          phone: cleanPhone,
        },
      });

      if (createErr || !createdUser?.user) {
        return NextResponse.json(
          { success: false, error: createErr?.message || 'Failed to create founder account' },
          { status: 500 }
        );
      }

      userId = createdUser.user.id;
    }

    // 2. Upsert profile record
    await supabase.from('profiles').upsert({
      id: userId,
      full_name: cleanFullName,
      email: cleanEmail,
      job_title: 'Founder & CEO',
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      userId,
      email: cleanEmail,
      fullName: cleanFullName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error setting up account';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
