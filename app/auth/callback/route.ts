import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = createServerSupabaseClient();
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (err) {
      console.warn('Auth code exchange notice in callback:', err);
    }
  }

  // Redirect to dashboard or designated authenticated entry point
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
