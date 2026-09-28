import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
  isSupabaseConfigured: true,
}));

import { executeChatApiRequest } from '@/app/ask-ai/page';
import { Transaction } from '@/types/finance';

describe('Client Chat Request Authentication Integration', () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const testWorkspaceId = 'e1ab89bf-153d-467b-a530-a6e7063efba1';
  const testTransactions: Transaction[] = [
    {
      id: 'tx-1',
      workspace_id: testWorkspaceId,
      transaction_date: '2026-03-01',
      description: 'Stripe Payout',
      amount: 15000,
      currency: 'USD',
      transaction_type: 'income',
      status: 'completed',
      source: 'manual',
      category: 'Revenue',
    },
  ];

  it('proves client request forwards authenticated Supabase access token in Authorization header', async () => {
    // 1. Mock active Supabase session
    const mockAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockToken';
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: mockAccessToken,
          user: { id: 'user-123' },
        },
      },
      error: null,
    });

    // 2. Mock successful chat response
    const mockChatResponse = {
      id: 'msg-response',
      role: 'assistant',
      content: 'We currently have $500,000 cash on hand.',
      timestamp: '12:00 PM',
      citations: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockChatResponse,
    });

    const result = await executeChatApiRequest(
      'how much cash do we currently have?',
      testWorkspaceId,
      testTransactions
    );

    // Assertions
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, requestInit] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/chat');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers).toEqual({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mockAccessToken}`,
    });

    const parsedBody = JSON.parse(requestInit.body);
    expect(parsedBody.workspaceId).toBe(testWorkspaceId);
    expect(parsedBody.message).toBe('how much cash do we currently have?');
    expect(parsedBody.transactions).toEqual(testTransactions);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockChatResponse);
    }
  });

  it('gracefully halts when user has no active session without sending unauthenticated request', async () => {
    // 1. Mock no active Supabase session
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: null,
      },
      error: null,
    });

    const result = await executeChatApiRequest(
      'how much cash do we currently have?',
      testWorkspaceId,
      testTransactions
    );

    // Fetch should NOT be invoked
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Authentication required');
    }
  });

  it('translates HTTP 401 server rejection to friendly session expired message', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'expired-token',
        },
      },
      error: null,
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid or expired authentication session.' }),
    });

    const result = await executeChatApiRequest('test question', testWorkspaceId, []);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Your session has expired or is invalid');
    }
  });

  it('translates HTTP 403 server rejection to friendly forbidden message', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'valid-token-unauthorized-workspace',
        },
      },
      error: null,
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden: You do not have access to this workspace.' }),
    });

    const result = await executeChatApiRequest('test question', testWorkspaceId, []);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('You do not have permission to access this workspace');
    }
  });
});
