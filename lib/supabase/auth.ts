import { supabase } from './client';
import { DatabaseProfile, DatabaseWorkspace, DatabaseWorkspaceMember } from './types';
import { UserProfile } from '@/types/finance';

export interface AuthSessionUser {
  id: string;
  email: string;
  profile: UserProfile | null;
  workspaces: DatabaseWorkspace[];
}

/**
 * Canonical production URL for FundFlow
 */
export const PRODUCTION_APP_URL = 'https://fundflow-nine.vercel.app';

/**
 * Checks if a hostname represents a private/local network or loopback address.
 */
function isLocalOrPrivateHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost') ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

/**
 * Normalizes URL string by trimming whitespace and trailing slashes.
 */
function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Checks whether an origin is trusted by FundFlow for authentication redirects.
 */
export function isTrustedOrigin(origin: string): boolean {
  if (!origin || typeof origin !== 'string') return false;
  try {
    const parsed = new URL(origin);
    const originClean = `${parsed.protocol}//${parsed.host}`.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    // 1. Explicit production canonical URL
    if (originClean === cleanUrl(PRODUCTION_APP_URL).toLowerCase()) {
      return true;
    }

    // 2. Explicitly configured app URLs from environment variables
    const configuredEnvUrls = [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.APP_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
    ].filter(Boolean) as string[];

    for (const envUrl of configuredEnvUrls) {
      try {
        const u = new URL(envUrl);
        if (process.env.NODE_ENV === 'production') {
          if (u.protocol !== 'https:' || isLocalOrPrivateHost(u.hostname)) {
            continue;
          }
        }
        if (`${u.protocol}//${u.host}`.toLowerCase() === originClean) {
          return true;
        }
      } catch {}
    }

    // 3. Vercel deployment URLs
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      const vProd = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.toLowerCase();
      if (originClean === vProd) return true;
    }
    if (process.env.VERCEL_URL) {
      const vUrl = `https://${process.env.VERCEL_URL}`.toLowerCase();
      if (originClean === vUrl) return true;
    }

    // 4. In development or test, allow local loopback, LAN IP addresses, and dev tunnels
    if (process.env.NODE_ENV !== 'production') {
      if (isLocalOrPrivateHost(hostname)) {
        return true;
      }
      if (
        hostname.endsWith('.ngrok-free.app') ||
        hostname.endsWith('.ngrok.io') ||
        hostname.endsWith('.loca.lt')
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts and reconstructs origin from request headers.
 */
function extractRequestOrigin(req?: Request): string | null {
  if (!req) return null;
  try {
    const originHeader = req.headers.get('origin');
    if (originHeader && originHeader !== 'null') {
      const u = new URL(originHeader);
      return `${u.protocol}//${u.host}`;
    }

    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    if (forwardedHost) {
      const host = forwardedHost.split(',')[0].trim();
      return `${forwardedProto}://${host}`;
    }

    const hostHeader = req.headers.get('host');
    if (hostHeader) {
      const isHttps = req.headers.get('x-forwarded-proto') === 'https';
      const proto = isHttps ? 'https' : 'http';
      return `${proto}://${hostHeader.trim()}`;
    }

    if ('nextUrl' in req) {
      const nextReq = req as { nextUrl?: { origin?: string } };
      if (nextReq.nextUrl?.origin && nextReq.nextUrl.origin !== 'null') {
        return nextReq.nextUrl.origin;
      }
    }

    if (req.url) {
      const u = new URL(req.url);
      return `${u.protocol}//${u.host}`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolves the trusted base URL for the application.
 * In production: Never returns localhost; uses configured app URL or canonical FundFlow domain.
 * In development: Uses configured app URL, reachable host from request headers, or localhost.
 */
export function getAppBaseUrl(req?: Request): string {
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Explicit environment variable
  const rawEnvUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  if (rawEnvUrl && rawEnvUrl.trim()) {
    try {
      const parsed = new URL(rawEnvUrl.trim());
      const cleaned = cleanUrl(`${parsed.protocol}//${parsed.host}`);

      if (isProd) {
        // In production, only accept valid HTTPS origins that are not localhost or private hosts
        if (parsed.protocol === 'https:' && !isLocalOrPrivateHost(parsed.hostname)) {
          return cleaned;
        }
      } else {
        // In development, preserve legitimate local, LAN, tunnel, or custom URLs
        return cleaned;
      }
    } catch {}
  }

  if (isProd) {
    // In production, strictly use canonical domain or configured Vercel production URL.
    // Never derive the callback origin from arbitrary request headers (Host / X-Forwarded-Host).
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    return PRODUCTION_APP_URL;
  }

  // Development / Test mode:
  // Accept request origin only through a clearly defined, validated mechanism (local, LAN, or recognized dev tunnel).
  const reqOrigin = extractRequestOrigin(req);
  if (reqOrigin) {
    try {
      const u = new URL(reqOrigin);
      const hostname = u.hostname.toLowerCase();
      if (
        isLocalOrPrivateHost(hostname) ||
        hostname.endsWith('.ngrok-free.app') ||
        hostname.endsWith('.ngrok.io') ||
        hostname.endsWith('.loca.lt')
      ) {
        return cleanUrl(`${u.protocol}//${u.host}`);
      }
    } catch {}
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      const u = new URL(window.location.origin);
      const hostname = u.hostname.toLowerCase();
      if (
        isLocalOrPrivateHost(hostname) ||
        hostname.endsWith('.ngrok-free.app') ||
        hostname.endsWith('.ngrok.io') ||
        hostname.endsWith('.loca.lt')
      ) {
        return cleanUrl(window.location.origin);
      }
    } catch {}
  }

  return 'http://localhost:3000';
}

/**
 * Generates the full email-confirmation callback URL.
 */
export function getAuthCallbackUrl(req?: Request, nextParam?: string): string {
  const base = getAppBaseUrl(req);
  const callbackUrl = new URL('/auth/callback', base);
  if (nextParam) {
    const safeNext = validateRedirectUrl(nextParam, '/dashboard');
    if (safeNext !== '/dashboard') {
      callbackUrl.searchParams.set('next', safeNext);
    }
  }
  return callbackUrl.toString();
}

/**
 * Validates a redirect destination against trusted application paths and origins.
 * Prevents open redirects to arbitrary third-party domains.
 */
export function validateRedirectUrl(
  url: string | null | undefined,
  fallback: string = '/dashboard'
): string {
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return fallback;
  }

  // Reject CRLF or control characters
  if (/[\r\n\t\0]/.test(trimmed)) {
    return fallback;
  }

  // Reject protocol-relative or backslash-tricked URLs (e.g. //evil.com, /\evil.com)
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.startsWith('\\')) {
    return fallback;
  }

  // Allow safe relative paths
  if (trimmed.startsWith('/') && !trimmed.startsWith('/javascript:') && !trimmed.startsWith('/data:')) {
    return trimmed;
  }

  // For absolute URLs, require that origin is trusted
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback;
    }

    if (isTrustedOrigin(parsed.origin)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/dashboard';
    }
  } catch {}

  return fallback;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign up a new user and create their initial profile
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  jobTitle: string = 'Founder',
  companyName: string = '',
  redirectTo?: string
) {
  const emailRedirectTo = redirectTo || getAuthCallbackUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        job_title: jobTitle,
        ...(companyName ? { company_name: companyName } : {}),
      },
      emailRedirectTo,
    },
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  if (user) {
    // Upsert user profile in profiles table
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName || 'Founder',
        email: email,
        job_title: jobTitle,
        updated_at: new Date().toISOString(),
      });
    } catch (profErr) {
      console.warn('Profile creation note:', profErr);
    }
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Get current authenticated session and user details
 */
export async function getCurrentAuthUser(): Promise<AuthSessionUser | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return null;
    }

    const user = session.user;

    // Fetch user profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .limit(1)
      .single();

    const dbProfile = profileData as DatabaseProfile | null;

    // Fetch workspaces the user belongs to
    const { data: members } = await supabase
      .from('workspace_members')
      .select('*, workspaces(*)')
      .eq('user_id', user.id);

    const workspaces: DatabaseWorkspace[] = [];
    if (members && members.length > 0) {
      for (const m of members as (DatabaseWorkspaceMember & { workspaces: DatabaseWorkspace | null })[]) {
        if (m.workspaces) {
          workspaces.push(m.workspaces);
        }
      }
    }

    const profile: UserProfile = {
      id: user.id,
      full_name: dbProfile?.full_name || user.user_metadata?.full_name || 'Founder',
      email: user.email || '',
      avatar_url: dbProfile?.avatar_url || undefined,
      role: 'owner',
    };

    return {
      id: user.id,
      email: user.email || '',
      profile,
      workspaces,
    };
  } catch (err) {
    console.error('Error getting current auth user:', err);
    return null;
  }
}

/**
 * Create a new workspace and add creator as owner
 */
export async function createNewWorkspace(
  userId: string,
  name: string,
  currency: string = 'USD',
  startingCash: number = 500000,
  alertRunwayThreshold: number = 6
): Promise<DatabaseWorkspace | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const effectiveUserId = session?.user?.id || userId;

    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: effectiveUserId,
        name,
        currency,
        startingCash,
        alertRunwayThreshold,
      }),
    });

    const data = await res.json().catch(() => ({ success: false, error: 'Server returned an invalid response' }));

    if (!res.ok || !data.success) {
      throw new Error(data.error || `Server error (${res.status}): Failed to create workspace`);
    }

    return data.workspace as DatabaseWorkspace;
  } catch (err) {
    console.error('Exception creating new workspace:', err);
    throw err;
  }
}
