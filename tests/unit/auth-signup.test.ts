import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DEMO_WORKSPACE, DEMO_USER, DEMO_TRANSACTIONS } from '@/lib/store/demo-data';

// Mock Supabase clients
const mockSignUp = vi.fn();
const mockAdminFrom = vi.fn();
const mockGetUser = vi.fn();
const mockExchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
  isSupabaseConfigured: true,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
    },
    from: (...args: unknown[]) => mockAdminFrom(...args),
  }),
}));

import { POST as signupHandler } from '@/app/api/auth/signup/route';
import { POST as workspaceHandler } from '@/app/api/workspaces/route';
import { GET as callbackHandler } from '@/app/auth/callback/route';
import {
  getAppBaseUrl,
  getAuthCallbackUrl,
  validateRedirectUrl,
  isTrustedOrigin,
  PRODUCTION_APP_URL,
} from '@/lib/supabase/auth';

describe('Real User Signup & Workspace Provisioning Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createSignupRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
  }

  describe('Input Validation & Sanitization', () => {
    it('rejects signup with empty full name', async () => {
      const req = createSignupRequest({
        fullName: '   ',
        companyName: 'Acme Corp',
        email: 'founder@acme.com',
        password: 'ValidPassword123!',
      });
      const res = await signupHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Full name is required');
    });

    it('rejects signup with empty company/business name', async () => {
      const req = createSignupRequest({
        fullName: 'Alex Rivera',
        companyName: '   ',
        email: 'founder@acme.com',
        password: 'ValidPassword123!',
      });
      const res = await signupHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Business / Company name is required');
    });

    it('rejects signup with invalid email format', async () => {
      const req = createSignupRequest({
        fullName: 'Alex Rivera',
        companyName: 'Acme Corp',
        email: 'not-an-email',
        password: 'ValidPassword123!',
      });
      const res = await signupHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('valid email address');
    });

    it('rejects signup with weak password (< 6 chars)', async () => {
      const req = createSignupRequest({
        fullName: 'Alex Rivera',
        companyName: 'Acme Corp',
        email: 'founder@acme.com',
        password: '123',
      });
      const res = await signupHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Password must be at least 6 characters');
    });
  });

  describe('Existing Account Handling', () => {
    it('returns HTTP 409 when Supabase reports user already registered', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'User already registered', status: 400 },
      });

      const req = createSignupRequest({
        fullName: 'Alex Rivera',
        companyName: 'Acme Corp',
        email: 'existing@acme.com',
        password: 'Password123!',
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('USER_ALREADY_EXISTS');
      expect(data.error).toContain('An account with this email already exists');
    });

    it('returns HTTP 409 when Supabase returns identities: [] (email enumeration prevention)', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'existing-uid-123', email: 'existing@acme.com', identities: [] },
          session: null,
        },
        error: null,
      });

      const req = createSignupRequest({
        fullName: 'Alex Rivera',
        companyName: 'Acme Corp',
        email: 'existing@acme.com',
        password: 'Password123!',
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('USER_ALREADY_EXISTS');
      expect(data.error).toContain('An account with this email already exists');
    });
  });

  describe('Real Workspace Provisioning & Isolation', () => {
    it('successfully provisions new real workspace without demo data when email confirmation is enabled', async () => {
      const newUserId = 'new-user-uuid-999';
      const newWsId = 'new-ws-uuid-777';

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: newUserId,
            email: 'newfounder@acme.com',
            identities: [{ id: 'ident-1' }],
          },
          session: null, // Email confirmation enabled
        },
        error: null,
      });

      // Chain mock for admin DB operations
      const mockUpsertProfile = vi.fn().mockResolvedValue({ error: null });
      const mockSelectWs = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [] }), // No existing workspace
        }),
      });
      const mockInsertWs = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: newWsId,
              name: 'Brand New Startup LLC',
              slug: 'brand-new-startup-llc',
              owner_id: newUserId,
              currency: 'USD',
              starting_cash: 0,
              alert_runway_threshold: 6,
            },
            error: null,
          }),
        }),
      });
      const mockUpsertMember = vi.fn().mockResolvedValue({ error: null });
      const mockInsertCategories = vi.fn().mockResolvedValue({ error: null });
      const mockUpsertAlertPrefs = vi.fn().mockResolvedValue({ error: null });

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return { upsert: mockUpsertProfile };
        if (table === 'workspaces') return { select: mockSelectWs, insert: mockInsertWs };
        if (table === 'workspace_members') return { upsert: mockUpsertMember };
        if (table === 'transaction_categories') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }), insert: mockInsertCategories };
        if (table === 'alert_preferences') return { upsert: mockUpsertAlertPrefs };
        return { select: vi.fn(), insert: vi.fn(), upsert: vi.fn() };
      });

      const req = createSignupRequest({
        fullName: 'New Founder',
        companyName: 'Brand New Startup LLC',
        email: 'newfounder@acme.com',
        password: 'ValidPassword123!',
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.userId).toBe(newUserId);
      expect(data.workspaceId).toBe(newWsId);
      expect(data.requiresEmailConfirmation).toBe(true);
      expect(data.workspace.starting_cash).toBe(0);

      // Verify owner membership assignment
      expect(mockUpsertMember).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: newWsId,
          user_id: newUserId,
          role: 'owner',
        }),
        expect.anything()
      );

      // Verify that no transactions were inserted into the transactions table
      expect(mockAdminFrom).not.toHaveBeenCalledWith('transactions');
    });

    it('preserves Demo Workspace data strictly isolated from real accounts', () => {
      expect(DEMO_WORKSPACE.id).toBe('e1ab89bf-153d-467b-a530-a6e7063efba1');
      expect(DEMO_WORKSPACE.name).toBe('Acme Technologies');
      expect(DEMO_USER.email).toBe('alex.rivera@demo.fundflow.app');
      expect(DEMO_TRANSACTIONS.length).toBeGreaterThan(0);
    });
  });

  describe('Workspace Endpoint Security (POST /api/workspaces)', () => {
    it('rejects unauthenticated requests lacking a Bearer token with HTTP 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/workspaces', {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: 'Hacker Workspace',
          currency: 'USD',
          startingCash: 0,
        }),
      });

      const res = await workspaceHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Authentication required');
    });

    it('rejects spoofed userId when it does not match the authenticated token with HTTP 403', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/workspaces', {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-token',
        }),
        body: JSON.stringify({
          userId: '22222222-2222-4222-8222-222222222222', // Mismatched spoofed userId
          name: 'Hacked Workspace',
          currency: 'USD',
          startingCash: 0,
        }),
      });

      const res = await workspaceHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });
  });

  describe('Email Confirmation Callback URL & Redirect Destination Security', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAppUrl = process.env.APP_URL;
    const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const originalVercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const originalVercelUrl = process.env.VERCEL_URL;

    afterEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
      if (originalAppUrl !== undefined) {
        process.env.APP_URL = originalAppUrl;
      } else {
        delete process.env.APP_URL;
      }
      if (originalNextPublicAppUrl !== undefined) {
        process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
      } else {
        delete process.env.NEXT_PUBLIC_APP_URL;
      }
      if (originalVercelProdUrl !== undefined) {
        process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelProdUrl;
      } else {
        delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      }
      if (originalVercelUrl !== undefined) {
        process.env.VERCEL_URL = originalVercelUrl;
      } else {
        delete process.env.VERCEL_URL;
      }
    });

    describe('Local Development Callback URL Reachability', () => {
      it('uses localhost:3000 callback when signing up on default local development host', () => {
        delete process.env.APP_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        const req = new NextRequest('http://localhost:3000/api/auth/signup', {
          headers: new Headers({ origin: 'http://localhost:3000' }),
        });
        const callbackUrl = getAuthCallbackUrl(req);
        expect(callbackUrl).toBe('http://localhost:3000/auth/callback');
      });

      it('uses reachable LAN IP callback URL when user accesses from phone on local Wi-Fi', () => {
        delete process.env.APP_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        const req = new NextRequest('http://192.168.1.50:3000/api/auth/signup', {
          headers: new Headers({
            origin: 'http://192.168.1.50:3000',
            host: '192.168.1.50:3000',
          }),
        });
        const callbackUrl = getAuthCallbackUrl(req);
        expect(callbackUrl).toBe('http://192.168.1.50:3000/auth/callback');
      });

      it('respects reverse proxy / tunnel headers (x-forwarded-host) in development', () => {
        delete process.env.APP_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        const req = new NextRequest('http://localhost:3000/api/auth/signup', {
          headers: new Headers({
            'x-forwarded-host': 'my-tunnel.ngrok-free.app',
            'x-forwarded-proto': 'https',
          }),
        });
        const callbackUrl = getAuthCallbackUrl(req);
        expect(callbackUrl).toBe('https://my-tunnel.ngrok-free.app/auth/callback');
      });

      it('prioritizes explicit NEXT_PUBLIC_APP_URL configuration in local development', () => {
        process.env.NEXT_PUBLIC_APP_URL = 'http://192.168.1.120:3000';
        const req = new NextRequest('http://localhost:3000/api/auth/signup', {
          headers: new Headers({ origin: 'http://localhost:3000' }),
        });
        const callbackUrl = getAuthCallbackUrl(req);
        expect(callbackUrl).toBe('http://192.168.1.120:3000/auth/callback');
      });

      it('rejects untrusted third-party host header in development and falls back to localhost', () => {
        delete process.env.APP_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        const req = new NextRequest('http://localhost:3000/api/auth/signup', {
          headers: new Headers({
            host: 'attacker.com',
            origin: 'https://attacker.com',
            'x-forwarded-host': 'attacker.com',
          }),
        });
        const callbackUrl = getAuthCallbackUrl(req);
        expect(callbackUrl).toBe('http://localhost:3000/auth/callback');
      });

      it('passes trusted callback URL to supabase.auth.signUp during signup execution', async () => {
        mockSignUp.mockResolvedValueOnce({
          data: {
            user: { id: 'test-user-id', email: 'founder@test.com', identities: [{ id: '1' }] },
            session: null,
          },
          error: null,
        });

        const req = new NextRequest('http://192.168.1.88:3000/api/auth/signup', {
          method: 'POST',
          headers: new Headers({
            'Content-Type': 'application/json',
            origin: 'http://192.168.1.88:3000',
          }),
          body: JSON.stringify({
            fullName: 'Test Founder',
            companyName: 'Test Tech',
            email: 'founder@test.com',
            password: 'ValidPassword123!',
          }),
        });

        await signupHandler(req);

        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'founder@test.com',
            options: expect.objectContaining({
              emailRedirectTo: 'http://192.168.1.88:3000/auth/callback',
            }),
          })
        );
      });
    });

    describe('Production Callback URL Resolution', () => {
      it('resolves to canonical FundFlow production domain and never localhost in production', () => {
        delete process.env.APP_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

        // Even if request somehow carries localhost header
        const req = new NextRequest('http://localhost:3000/api/auth/signup', {
          headers: new Headers({ origin: 'http://localhost:3000' }),
        });

        const callbackUrl = getAuthCallbackUrl(req);
        expect(callbackUrl).toBe(`${PRODUCTION_APP_URL}/auth/callback`);
        expect(callbackUrl).not.toContain('localhost');
      });

      it('ignores attacker-controlled Host and X-Forwarded-Host headers in production and strictly uses canonical URL', () => {
        delete process.env.APP_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

        const req = new NextRequest('http://localhost:3000/api/auth/signup', {
          headers: new Headers({
            host: 'attacker-controlled.com',
            'x-forwarded-host': 'attacker-controlled.com',
            origin: 'https://attacker-controlled.com',
          }),
        });

        const callbackUrl = getAuthCallbackUrl(req);
        expect(callbackUrl).toBe(`${PRODUCTION_APP_URL}/auth/callback`);
        expect(callbackUrl).not.toContain('attacker-controlled');
      });

      it('resolves to custom configured domain when APP_URL is set in production', () => {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        process.env.APP_URL = 'https://app.fundflow.co';

        const callbackUrl = getAuthCallbackUrl();
        expect(callbackUrl).toBe('https://app.fundflow.co/auth/callback');
      });

      it('rejects misconfigured localhost environment variable in production and falls back to canonical URL', () => {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        process.env.APP_URL = 'http://localhost:3000';

        const callbackUrl = getAuthCallbackUrl();
        expect(callbackUrl).toBe(`${PRODUCTION_APP_URL}/auth/callback`);
        expect(callbackUrl).not.toContain('localhost');
      });

      it('rejects misconfigured non-HTTPS environment variable in production and falls back to canonical URL', () => {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        process.env.NEXT_PUBLIC_APP_URL = 'http://insecure-domain.com';

        const callbackUrl = getAuthCallbackUrl();
        expect(callbackUrl).toBe(`${PRODUCTION_APP_URL}/auth/callback`);
        expect(callbackUrl).not.toContain('insecure-domain.com');
      });
    });

    describe('Redirect Destination Validation & Open Redirect Prevention', () => {
      it('allows safe relative internal application paths', () => {
        expect(validateRedirectUrl('/dashboard')).toBe('/dashboard');
        expect(validateRedirectUrl('/login')).toBe('/login');
        expect(validateRedirectUrl('/onboarding')).toBe('/onboarding');
        expect(validateRedirectUrl('/dashboard?verified=true')).toBe('/dashboard?verified=true');
      });

      it('falls back to /dashboard for empty or null inputs', () => {
        expect(validateRedirectUrl(null)).toBe('/dashboard');
        expect(validateRedirectUrl(undefined)).toBe('/dashboard');
        expect(validateRedirectUrl('')).toBe('/dashboard');
        expect(validateRedirectUrl('   ')).toBe('/dashboard');
      });

      it('rejects protocol-relative open redirect attacks', () => {
        expect(validateRedirectUrl('//evil.com')).toBe('/dashboard');
        expect(validateRedirectUrl('//attacker.com/steal-session')).toBe('/dashboard');
      });

      it('rejects backslash-trick open redirect attacks', () => {
        expect(validateRedirectUrl('/\\evil.com')).toBe('/dashboard');
        expect(validateRedirectUrl('\\evil.com')).toBe('/dashboard');
      });

      it('rejects javascript and data URIs', () => {
        expect(validateRedirectUrl('javascript:alert(document.cookie)')).toBe('/dashboard');
        expect(validateRedirectUrl('/javascript:void(0)')).toBe('/dashboard');
      });

      it('rejects untrusted third-party domains', () => {
        expect(validateRedirectUrl('https://evil.com/phishing')).toBe('/dashboard');
        expect(validateRedirectUrl('http://attacker.org/callback')).toBe('/dashboard');
      });

      it('converts trusted domain absolute URL to safe internal relative path', () => {
        expect(validateRedirectUrl(`${PRODUCTION_APP_URL}/onboarding`)).toBe('/onboarding');
        expect(validateRedirectUrl(`${PRODUCTION_APP_URL}/reports?view=summary`)).toBe('/reports?view=summary');
      });

      it('trusts canonical production URL and configured Vercel URL, but rejects unrelated Vercel preview hostnames in production', () => {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        process.env.VERCEL_URL = 'fundflow-deployment-123.vercel.app';

        // Canonical production URL is trusted
        expect(isTrustedOrigin(PRODUCTION_APP_URL)).toBe(true);
        expect(validateRedirectUrl(`${PRODUCTION_APP_URL}/onboarding`)).toBe('/onboarding');

        // Configured Vercel deployment URL is trusted
        expect(isTrustedOrigin('https://fundflow-deployment-123.vercel.app')).toBe(true);
        expect(validateRedirectUrl('https://fundflow-deployment-123.vercel.app/onboarding')).toBe('/onboarding');

        // Unrelated arbitrary Vercel hostname is rejected in production
        expect(isTrustedOrigin('https://unrelated-attacker.vercel.app')).toBe(false);
        expect(validateRedirectUrl('https://unrelated-attacker.vercel.app/phishing')).toBe('/dashboard');
      });
    });

    describe('Callback Route Handling (GET /auth/callback)', () => {
      it('exchanges authorization code and redirects to dashboard by default', async () => {
        mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

        const req = new NextRequest('http://localhost:3000/auth/callback?code=pkce-auth-code-123');
        const res = await callbackHandler(req);

        expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-auth-code-123');
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
      });

      it('redirects to safe validated custom path when valid next parameter is supplied', async () => {
        mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

        const req = new NextRequest('http://localhost:3000/auth/callback?code=pkce-auth-code-123&next=/login');
        const res = await callbackHandler(req);

        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe('http://localhost:3000/login');
      });

      it('sanitizes malicious next parameter and redirects to safe fallback (/dashboard)', async () => {
        mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

        const req = new NextRequest('http://localhost:3000/auth/callback?code=pkce-auth-code-123&next=https://evil.com');
        const res = await callbackHandler(req);

        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
      });
    });
  });
});
