import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase Server Client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

import { POST } from '@/app/api/chat/route';

describe('POST /api/chat Multi-Tenant Authentication & Authorization', () => {
  const validWorkspaceId = 'e1ab89bf-153d-467b-a530-a6e7063efba1';
  const ownerUserId = 'user-owner-111';
  const memberUserId = 'user-member-222';
  const strangerUserId = 'user-stranger-999';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: Record<string, unknown>, authHeader?: string): NextRequest {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }

    return new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  // 1. Missing Authorization header -> 401
  it('rejects requests missing an Authorization header with HTTP 401', async () => {
    const req = createRequest({
      message: 'What is our runway?',
      workspaceId: validWorkspaceId,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Missing or malformed Authorization header');
  });

  // 2. Invalid/unknown token -> 401
  it('rejects requests with an invalid or expired bearer token with HTTP 401', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid JWT' },
    });

    const req = createRequest(
      {
        message: 'What is our runway?',
        workspaceId: validWorkspaceId,
      },
      'Bearer invalid-token-xyz'
    );

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Invalid or expired authentication session');
  });

  // 3. Authenticated user without workspace membership -> 403
  it('rejects authenticated users who are neither owner nor member with HTTP 403', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: strangerUserId, email: 'stranger@example.com' } },
      error: null,
    });

    // Mock workspaces table query: workspace exists, but owner is ownerUserId
    const mockWorkspaceSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: validWorkspaceId,
              name: 'Alpha Corp',
              owner_id: ownerUserId,
              currency: 'USD',
              created_at: '2023-01-01',
            },
            error: null,
          }),
        }),
      }),
    });

    // Mock workspace_members table query: no membership found
    const mockMembersSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') return { select: mockWorkspaceSelect };
      if (table === 'workspace_members') return { select: mockMembersSelect };
      return { select: vi.fn() };
    });

    const req = createRequest(
      {
        message: 'What is our runway?',
        workspaceId: validWorkspaceId,
      },
      'Bearer valid-stranger-token'
    );

    const res = await POST(req);
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error).toContain('Forbidden: You do not have access to this workspace');
  });

  // Helper to setup mock Supabase responses for authorized calls
  function setupAuthorizedDbMocks(userId: string, isOwner: boolean, role: string = 'member') {
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId, email: `${userId}@example.com` } },
      error: null,
    });

    const mockWorkspaceSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: validWorkspaceId,
              name: 'Alpha Corp',
              owner_id: isOwner ? userId : ownerUserId,
              currency: 'USD',
              created_at: '2023-01-01',
            },
            error: null,
          }),
        }),
      }),
    });

    const mockMembersSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: isOwner ? [] : [{ role }],
            error: null,
          }),
        }),
      }),
    });

    const mockGenericSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'conv-123' }, error: null }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') return { select: mockWorkspaceSelect };
      if (table === 'workspace_members') return { select: mockMembersSelect };
      if (table === 'ai_conversations') return { insert: mockInsert };
      if (table === 'ai_messages') return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      return { select: mockGenericSelect };
    });
  }

  // 4. Workspace owner -> allowed
  it('allows access for workspace owner and processes chat request', async () => {
    setupAuthorizedDbMocks(ownerUserId, true);

    const req = createRequest(
      {
        message: 'How is runway calculated?',
        workspaceId: validWorkspaceId,
        transactions: [],
      },
      'Bearer valid-owner-token'
    );

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.grounded).toBe(true);
    expect(json.detectedIntent).toContain('EXPLAIN_CALCULATION');
  });

  // 5. Workspace member -> allowed
  it('allows access for verified workspace member', async () => {
    setupAuthorizedDbMocks(memberUserId, false, 'member');

    const req = createRequest(
      {
        message: 'How is runway calculated?',
        workspaceId: validWorkspaceId,
        transactions: [],
      },
      'Bearer valid-member-token'
    );

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.grounded).toBe(true);
  });

  // 6. Authorized request continues through existing chat pipeline
  it('continues through existing chat pipeline and returns structured response', async () => {
    setupAuthorizedDbMocks(ownerUserId, true);

    const req = createRequest(
      {
        message: 'What is EBITDA?',
        workspaceId: validWorkspaceId,
        transactions: [],
      },
      'Bearer valid-owner-token'
    );

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.grounded).toBe(true);
    expect(json.content).toContain('Earnings Before Interest, Taxes, Depreciation, and Amortization');
    expect(json.keyPoints).toBeDefined();
    expect(json.requestId).toBeDefined();
  });
});
