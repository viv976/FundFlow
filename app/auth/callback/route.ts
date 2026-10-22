import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAppBaseUrl, validateRedirectUrl } from '@/lib/supabase/auth';

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');

  if (code) {
    const supabase = createServerSupabaseClient();
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (err) {
      console.warn('Auth code exchange notice in callback:', err);
    }
  }

  // Resolve trusted application base URL and validate redirect destination
  const baseUrl = getAppBaseUrl(req);
  const safeNext = validateRedirectUrl(next, '/dashboard');

  // Redirect to validated destination on trusted base URL
  return NextResponse.redirect(new URL(safeNext, baseUrl));
}
