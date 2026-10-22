import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();

const mockFrom = vi.fn((table: string) => {
  return {
    select: (...args: unknown[]) => {
      mockSelect(table, ...args);
      return {
        eq: (...eqArgs: unknown[]) => {
          mockEq(table, ...eqArgs);
          if (table === 'workspaces') {
            return Promise.resolve({
              data: [{ id: 'owned-ws-1' }, { id: 'owned-ws-2' }],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
    delete: () => {
      mockDelete(table);
      return {
        eq: (...eqArgs: unknown[]) => {
          mockEq(table, ...eqArgs);
          return Promise.resolve({ error: null });
        },
        in: (...inArgs: unknown[]) => {
          mockIn(table, ...inArgs);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      admin: {
        deleteUser: (...args: unknown[]) => mockAdminDeleteUser(...args),
      },
    },
    from: (table: string) => mockFrom(table),
  }),
}));

const mockGetSession = vi.fn();
const mockClientSignOut = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signOut: (...args: unknown[]) => mockClientSignOut(...args),
    },
  },
  isSupabaseConfigured: true,
}));

import {
  POST as deleteAccountPost,
  DELETE as deleteAccountDelete,
} from '@/app/api/auth/delete-account/route';
import { deleteAccount } from '@/lib/supabase/auth';

describe('Account Management: Deletion & Sign Out Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API: /api/auth/delete-account', () => {
    it('rejects unauthenticated requests without authorization header (401)', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/delete-account', {
        method: 'DELETE',
      });
      const res = await deleteAccountDelete(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('missing authorization header');
    });

    it('rejects requests with invalid or expired session token (401)', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: null,
        error: new Error('JWT expired'),
      });

      const req = new NextRequest('http://localhost:3000/api/auth/delete-account', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      const res = await deleteAccountPost(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('invalid or expired session');
    });

    it('successfully processes account deletion for authenticated user', async () => {
      const testUserId = 'user-uuid-1234';
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: testUserId, email: 'founder@startup.com' } },
        error: null,
      });
      mockAdminDeleteUser.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost:3000/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-session-token',
        },
      });

      const res = await deleteAccountDelete(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify workspace_members cleanup
      expect(mockDelete).toHaveBeenCalledWith('workspace_members');
      expect(mockEq).toHaveBeenCalledWith('workspace_members', 'user_id', testUserId);

      // Verify owned workspaces cleanup
      expect(mockDelete).toHaveBeenCalledWith('workspaces');
      expect(mockIn).toHaveBeenCalledWith('workspaces', 'id', ['owned-ws-1', 'owned-ws-2']);

      // Verify profiles cleanup
      expect(mockDelete).toHaveBeenCalledWith('profiles');
      expect(mockEq).toHaveBeenCalledWith('profiles', 'id', testUserId);

      // Verify auth.users admin deletion
      expect(mockAdminDeleteUser).toHaveBeenCalledWith(testUserId);
    });

    it('supports both POST and DELETE HTTP verbs idempotently', async () => {
      const testUserId = 'user-uuid-post';
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: testUserId } },
        error: null,
      });
      mockAdminDeleteUser.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost:3000/api/auth/delete-account', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token-post',
        },
      });

      const res = await deleteAccountPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Client Helper: deleteAccount()', () => {
    it('returns error if user has no active session', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });
      const result = await deleteAccount();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    it('calls endpoint with bearer token and returns success', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'fake-access-token-123' } },
      });

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      const result = await deleteAccount();
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/delete-account',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-access-token-123',
          }),
        })
      );
    });
  });

  describe('Sign Out & Landing Page Redirection', () => {
    it('calls supabase auth.signOut() cleanly', async () => {
      const { supabase } = await import('@/lib/supabase/client');
      const spy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.signOut>>);

      const { signOut } = await import('@/lib/supabase/auth');
      await signOut();
      expect(spy).toHaveBeenCalled();
    });

    it('handles sign out errors by propagating for caller handling', async () => {
      const { supabase } = await import('@/lib/supabase/client');
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({
        error: new Error('Network failure'),
      } as unknown as Awaited<ReturnType<typeof supabase.auth.signOut>>);

      const { signOut } = await import('@/lib/supabase/auth');
      await expect(signOut()).rejects.toThrow('Network failure');
    });
  });
});
