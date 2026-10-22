import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase clients
const mockSignUp = vi.fn();
const mockAdminFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: (...args: unknown[]) => mockAdminFrom(...args),
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
import { fetchWorkspaceAndProfile } from '@/lib/supabase/db';
import {
  SUPPORTED_INDUSTRIES,
  DEFAULT_INDUSTRY,
  DEFAULT_CURRENCY,
  DEFAULT_STARTING_CASH,
  DEFAULT_RUNWAY_ALERT_THRESHOLD,
} from '@/lib/finance/calculator';

describe('First-Workspace Onboarding Regression Suite', () => {
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

  function createWorkspaceRequest(body: Record<string, unknown>, token?: string): NextRequest {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return new NextRequest('http://localhost:3000/api/workspaces', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  // =========================================================================
  // 1. Custom Currency & Industry Metadata Persistence
  // =========================================================================
  describe('Custom Currency & Industry Metadata Persistence during Signup', () => {
    it('persists selected industry in Auth user metadata and selected currency in workspace', async () => {
      const userId = '11111111-1111-4111-8111-111111111111';
      const wsId = '22222222-2222-4222-8222-222222222222';

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: userId,
            email: 'founder@healthbiotech.io',
            user_metadata: {
              full_name: 'Dr. Jane Doe',
              company_name: 'BioHealth Labs',
              industry: 'Healthcare & Biotech',
              currency: 'EUR',
            },
          },
          session: null,
        },
        error: null,
      });

      const mockInsertWs = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: wsId,
              name: 'BioHealth Labs',
              slug: 'biohealth-labs',
              owner_id: userId,
              currency: 'EUR',
              starting_cash: 750000,
              alert_runway_threshold: 12,
            },
            error: null,
          }),
        }),
      });

      const mockUpsertAlertPrefs = vi.fn().mockResolvedValue({ error: null });

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
            insert: mockInsertWs,
          };
        }
        if (table === 'workspace_members') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        if (table === 'transaction_categories') {
          return {
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'alert_preferences') return { upsert: mockUpsertAlertPrefs };
        return { select: vi.fn(), insert: vi.fn(), upsert: vi.fn() };
      });

      const req = createSignupRequest({
        fullName: 'Dr. Jane Doe',
        companyName: 'BioHealth Labs',
        email: 'founder@healthbiotech.io',
        password: 'SecurePassword123!',
        currency: 'EUR',
        industry: 'Healthcare & Biotech',
        startingCash: 750000,
        alertRunwayThreshold: 12,
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify industry and currency persisted in Supabase Auth user metadata
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'founder@healthbiotech.io',
          options: expect.objectContaining({
            data: expect.objectContaining({
              full_name: 'Dr. Jane Doe',
              company_name: 'BioHealth Labs',
              industry: 'Healthcare & Biotech',
              currency: 'EUR',
            }),
          }),
        })
      );

      // Verify workspace inserted with currency EUR, starting_cash 750000, and alert threshold 12
      expect(mockInsertWs).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'BioHealth Labs',
          owner_id: userId,
          currency: 'EUR',
          starting_cash: 750000,
          alert_runway_threshold: 12,
        })
      );

      // Verify alert_preferences configured with matching threshold 12
      expect(mockUpsertAlertPrefs).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: wsId,
          runway_threshold_months: 12,
        }),
        { onConflict: 'workspace_id' }
      );

      // Crucial: verify that NO fake transactions were created
      expect(mockAdminFrom).not.toHaveBeenCalledWith('transactions');
    });

    it('falls back to backward-compatible defaults when industry, cash, and threshold are omitted', async () => {
      const userId = '33333333-3333-4333-8333-333333333333';
      const wsId = '44444444-4444-4444-8444-444444444444';

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: userId,
            email: 'founder@defaulttech.io',
            user_metadata: {},
          },
          session: null,
        },
        error: null,
      });

      const mockInsertWs = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: wsId,
              name: 'Default Tech Inc',
              slug: 'default-tech-inc',
              owner_id: userId,
              currency: 'USD',
              starting_cash: 0,
              alert_runway_threshold: 6,
            },
            error: null,
          }),
        }),
      });

      const mockUpsertAlertPrefs = vi.fn().mockResolvedValue({ error: null });

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
            insert: mockInsertWs,
          };
        }
        if (table === 'workspace_members') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        if (table === 'transaction_categories') {
          return {
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [] }) }) }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'alert_preferences') return { upsert: mockUpsertAlertPrefs };
        return { select: vi.fn(), insert: vi.fn(), upsert: vi.fn() };
      });

      const req = createSignupRequest({
        fullName: 'Alex Founder',
        companyName: 'Default Tech Inc',
        email: 'founder@defaulttech.io',
        password: 'SecurePassword123!',
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(201);

      // Verify defaults in auth user metadata
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            data: expect.objectContaining({
              industry: DEFAULT_INDUSTRY,
              currency: DEFAULT_CURRENCY,
            }),
          }),
        })
      );

      // Verify defaults in workspace insertion: USD, starting_cash = 0, alert_runway_threshold = 6
      expect(mockInsertWs).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'USD',
          starting_cash: DEFAULT_STARTING_CASH,
          alert_runway_threshold: DEFAULT_RUNWAY_ALERT_THRESHOLD,
        })
      );

      // Verify alert preferences default threshold 6.0
      expect(mockUpsertAlertPrefs).toHaveBeenCalledWith(
        expect.objectContaining({
          runway_threshold_months: 6,
        }),
        expect.anything()
      );
    });
  });

  // =========================================================================
  // 2. Duplicate Workspace Prevention During Signup
  // =========================================================================
  describe('Duplicate Workspace Prevention', () => {
    it('returns existing workspace and never overwrites existing settings or alert preferences', async () => {
      const existingUserId = '55555555-5555-4555-8555-555555555555';
      const existingWsId = '66666666-6666-4666-8666-666666666666';

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: existingUserId,
            email: 'existing@corp.com',
          },
          session: null,
        },
        error: null,
      });

      const existingWorkspaceRow = {
        id: existingWsId,
        name: 'Existing Corporate Workspace',
        slug: 'existing-corporate-workspace',
        owner_id: existingUserId,
        currency: 'GBP',
        starting_cash: 500000,
        alert_runway_threshold: 9,
      };

      const mockInsertWs = vi.fn();
      const mockUpsertAlertPrefs = vi.fn();

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [existingWorkspaceRow] }),
              }),
            }),
            insert: mockInsertWs,
          };
        }
        if (table === 'workspace_members') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        if (table === 'alert_preferences') return { upsert: mockUpsertAlertPrefs };
        return { select: vi.fn(), insert: vi.fn(), upsert: vi.fn() };
      });

      const req = createSignupRequest({
        fullName: 'Existing User',
        companyName: 'New Company Attempt',
        email: 'existing@corp.com',
        password: 'Password123!',
        currency: 'USD',
        startingCash: 0,
        alertRunwayThreshold: 3,
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      // Returns existing workspace without inserting a duplicate
      expect(data.workspaceId).toBe(existingWsId);
      expect(mockInsertWs).not.toHaveBeenCalled();

      // Never overwrites existing alert_preferences
      expect(mockUpsertAlertPrefs).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Authenticated Workspace Creation Flow (/api/workspaces)
  // =========================================================================
  describe('Authenticated Workspace Creation (/api/workspaces)', () => {
    it('creates additional workspace for authenticated user with alert preferences configured', async () => {
      const authUserId = '77777777-7777-4777-8777-777777777777';
      const createdWsId = '88888888-8888-4888-8888-888888888888';
      const validToken = 'valid-jwt-token-123';

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: authUserId, email: 'authenticated@founder.io' } },
        error: null,
      });

      const mockInsertWs = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: createdWsId,
              name: 'Second Venture LLC',
              slug: 'second-venture-llc',
              owner_id: authUserId,
              currency: 'INR',
              starting_cash: 300000,
              alert_runway_threshold: 8,
            },
            error: null,
          }),
        }),
      });

      const mockUpsertAlertPrefs = vi.fn().mockResolvedValue({ error: null });
      const mockInsertMember = vi.fn().mockResolvedValue({ error: null });
      const mockInsertCategories = vi.fn().mockResolvedValue({ error: null });

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: authUserId } }),
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
            insert: mockInsertWs,
          };
        }
        if (table === 'workspace_members') return { insert: mockInsertMember };
        if (table === 'transaction_categories') return { insert: mockInsertCategories };
        if (table === 'alert_preferences') return { upsert: mockUpsertAlertPrefs };
        return { select: vi.fn(), insert: vi.fn(), upsert: vi.fn() };
      });

      const req = createWorkspaceRequest(
        {
          userId: authUserId,
          name: 'Second Venture LLC',
          currency: 'INR',
          startingCash: 300000,
          alertRunwayThreshold: 8,
          industry: 'Fintech & Financial Services',
        },
        validToken
      );

      const res = await workspaceHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.workspace.id).toBe(createdWsId);

      // Verify workspace record
      expect(mockInsertWs).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Second Venture LLC',
          owner_id: authUserId,
          currency: 'INR',
          starting_cash: 300000,
          alert_runway_threshold: 8,
        })
      );

      // Verify owner membership assigned
      expect(mockInsertMember).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: createdWsId,
          user_id: authUserId,
          role: 'owner',
        })
      );

      // Verify alert preference persisted with matching threshold
      expect(mockUpsertAlertPrefs).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: createdWsId,
          runway_threshold_months: 8,
        }),
        { onConflict: 'workspace_id' }
      );
    });

    it('rejects unauthenticated request to create workspace with 401', async () => {
      const req = createWorkspaceRequest({
        name: 'Unauthenticated Startup',
      });
      const res = await workspaceHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Authentication required');
    });

    it('rejects attempt to create workspace on behalf of another user with 403', async () => {
      const tokenUserId = 'aaaaaaaa-1111-4111-8111-111111111111';
      const spoofedUserId = 'bbbbbbbb-2222-4222-8222-222222222222';

      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: tokenUserId } },
        error: null,
      });

      const req = createWorkspaceRequest(
        {
          userId: spoofedUserId,
          name: 'Spoofed Workspace',
        },
        'token-for-user-a'
      );

      const res = await workspaceHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });
  });

  // =========================================================================
  // 4. Self-Healing Workspace Recovery Behavior
  // =========================================================================
  describe('Self-Healing Workspace Recovery Behavior', () => {
    it('preserves user metadata currency during self-healing recovery when user has zero workspaces', async () => {
      const authUserId = '99999999-aaaa-bbbb-cccc-dddddddddddd';
      const recoveredWsId = 'recov-1111-2222-3333-444444444444';

      // Mock session with custom user_metadata currency CAD and industry Healthcare & Biotech
      const mockSession = {
        access_token: 'recov-token-xyz',
        user: {
          id: authUserId,
          email: 'cad_founder@canada.ca',
          user_metadata: {
            company_name: 'Maple Analytics Corp',
            currency: 'CAD',
            industry: 'Healthcare & Biotech',
          },
        },
      };

      // Mock supabase client getSession
      const { supabase } = await import('@/lib/supabase/client');
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: mockSession as any },
      } as any);

      // Mock DB query showing zero memberships and zero owned workspaces
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [] }), // 0 workspaces
            }),
          };
        }
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [] }), // 0 owned workspaces
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [{ id: authUserId, full_name: 'CAD Founder' }] }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      // Mock fetch to /api/workspaces during self-healing
      const originalFetch = global.fetch;
      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === '/api/workspaces') {
          const body = JSON.parse(init?.body as string);
          return {
            ok: true,
            json: async () => ({
              success: true,
              workspace: {
                id: recoveredWsId,
                name: body.name,
                currency: body.currency,
                starting_cash: body.startingCash,
                alert_runway_threshold: body.alertRunwayThreshold,
                owner_id: body.userId,
                created_at: new Date().toISOString(),
              },
            }),
          };
        }
        return originalFetch(url, init);
      });
      global.fetch = fetchMock;

      try {
        const result = await fetchWorkspaceAndProfile();

        expect(fetchMock).toHaveBeenCalledWith(
          '/api/workspaces',
          expect.objectContaining({
            body: expect.stringContaining('"currency":"CAD"'),
          })
        );
        expect(result.workspace?.currency).toBe('CAD');
        expect(result.workspace?.name).toBe('Maple Analytics Corp');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('never triggers self-healing workspace recovery when user already has an existing workspace', async () => {
      const authUserId = '88888888-bbbb-cccc-dddd-eeeeeeeeeeee';
      const existingWsId = 'exist-1111-2222-3333-444444444444';

      const mockSession = {
        access_token: 'token-abc',
        user: {
          id: authUserId,
          email: 'existing@venture.com',
          user_metadata: {
            company_name: 'New Overwrite Attempt',
            currency: 'USD',
          },
        },
      };

      const { supabase } = await import('@/lib/supabase/client');
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: mockSession as any },
      } as any);

      const existingWs = {
        id: existingWsId,
        name: 'Preserved Original Workspace',
        owner_id: authUserId,
        currency: 'GBP',
        starting_cash: 900000,
        alert_runway_threshold: 12,
        created_at: '2026-01-01T00:00:00Z',
      };

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ workspaces: existingWs }],
              }),
            }),
          };
        }
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [existingWs] }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [{ id: authUserId }] }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const fetchMock = vi.fn();
      const originalFetch = global.fetch;
      global.fetch = fetchMock;

      try {
        const result = await fetchWorkspaceAndProfile();

        // Recovery /api/workspaces was NOT called
        expect(fetchMock).not.toHaveBeenCalled();

        // Existing workspace settings are completely preserved
        expect(result.workspace?.id).toBe(existingWsId);
        expect(result.workspace?.currency).toBe('GBP');
        expect(result.workspace?.starting_cash).toBe(900000);
        expect(result.workspace?.alert_runway_threshold).toBe(12);
        expect(result.workspace?.name).toBe('Preserved Original Workspace');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
