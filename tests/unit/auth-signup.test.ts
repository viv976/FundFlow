import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DEMO_WORKSPACE, DEMO_USER, DEMO_TRANSACTIONS } from '@/lib/store/demo-data';

// Mock Supabase clients
const mockSignUp = vi.fn();
const mockAdminFrom = vi.fn();
const mockGetUser = vi.fn();

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
    },
    from: (...args: unknown[]) => mockAdminFrom(...args),
  }),
}));

import { POST as signupHandler } from '@/app/api/auth/signup/route';
import { POST as workspaceHandler } from '@/app/api/workspaces/route';

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
});
