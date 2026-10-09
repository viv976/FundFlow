import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTabSessionId, tabAuthStorage } from '@/lib/supabase/client';

describe('Supabase Client Tab-Scoped Session Storage Isolation', () => {
  let tabAStore: Map<string, string>;
  let tabBStore: Map<string, string>;
  let sharedLocalStorage: Storage;

  beforeEach(() => {
    tabAStore = new Map();
    tabBStore = new Map();
    const localStore = new Map<string, string>();

    sharedLocalStorage = {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, value: string) => localStore.set(key, String(value)),
      removeItem: (key: string) => localStore.delete(key),
      clear: () => localStore.clear(),
      key: (i: number) => Array.from(localStore.keys())[i] ?? null,
      get length() {
        return localStore.size;
      },
    };
  });

  function activateTab(store: Map<string, string>) {
    const sessionStorage: Storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    };

    vi.stubGlobal('sessionStorage', sessionStorage);
    vi.stubGlobal('localStorage', sharedLocalStorage);
    vi.stubGlobal('window', {
      sessionStorage,
      localStorage: sharedLocalStorage,
    });
  }

  it('1. Tab A logs into Account A, Tab B logs into Account B, and Tab A preserves Account A after refresh', () => {
    // 1. Tab A initializes and logs in as Account A
    activateTab(tabAStore);
    const tabAId = getTabSessionId();
    expect(tabAId).toMatch(/^tab_/);
    const authKeyA = `sb_auth_token_${tabAId}`;

    const sessionA = JSON.stringify({
      access_token: 'token_account_a',
      user: { id: 'user_a_uuid', email: 'accountA@example.com' },
    });
    tabAuthStorage.setItem(authKeyA, sessionA);
    expect(tabAuthStorage.getItem(authKeyA)).toBe(sessionA);

    // 2. Tab B initializes in an isolated context and logs in as Account B
    activateTab(tabBStore);
    const tabBId = getTabSessionId();
    expect(tabBId).toMatch(/^tab_/);
    expect(tabBId).not.toBe(tabAId); // Unique per-tab session ID
    const authKeyB = `sb_auth_token_${tabBId}`;

    const sessionB = JSON.stringify({
      access_token: 'token_account_b',
      user: { id: 'user_b_uuid', email: 'accountB@example.com' },
    });
    tabAuthStorage.setItem(authKeyB, sessionB);
    expect(tabAuthStorage.getItem(authKeyB)).toBe(sessionB);

    // Verify localStorage has NOT been contaminated
    expect(sharedLocalStorage.getItem(authKeyA)).toBeNull();
    expect(sharedLocalStorage.getItem(authKeyB)).toBeNull();

    // 3. Tab A is refreshed (re-activated in global scope)
    activateTab(tabAStore);
    // Tab ID persists across refresh in sessionStorage
    const restoredTabAId = getTabSessionId();
    expect(restoredTabAId).toBe(tabAId);

    // Restored session in Tab A is genuine Account A
    const restoredSessionA = tabAuthStorage.getItem(`sb_auth_token_${restoredTabAId}`);
    expect(restoredSessionA).not.toBeNull();
    const parsedA = JSON.parse(restoredSessionA!);
    expect(parsedA.user.id).toBe('user_a_uuid');
    expect(parsedA.user.email).toBe('accountA@example.com');
    expect(parsedA.access_token).toBe('token_account_a');

    // 4. Verify Tab B still has Account B
    activateTab(tabBStore);
    const restoredTabBId = getTabSessionId();
    expect(restoredTabBId).toBe(tabBId);
    const restoredSessionB = tabAuthStorage.getItem(`sb_auth_token_${restoredTabBId}`);
    expect(restoredSessionB).not.toBeNull();
    const parsedB = JSON.parse(restoredSessionB!);
    expect(parsedB.user.id).toBe('user_b_uuid');
    expect(parsedB.user.email).toBe('accountB@example.com');
  });

  it('2. Sign out in Tab B does not sign out Tab A', () => {
    activateTab(tabAStore);
    const tabAId = getTabSessionId();
    const authKeyA = `sb_auth_token_${tabAId}`;
    tabAuthStorage.setItem(authKeyA, JSON.stringify({ user: { id: 'user_a_uuid' } }));

    activateTab(tabBStore);
    const tabBId = getTabSessionId();
    const authKeyB = `sb_auth_token_${tabBId}`;
    tabAuthStorage.setItem(authKeyB, JSON.stringify({ user: { id: 'user_b_uuid' } }));

    // Tab B signs out
    tabAuthStorage.removeItem(authKeyB);
    expect(tabAuthStorage.getItem(authKeyB)).toBeNull();

    // Tab A remains authenticated
    activateTab(tabAStore);
    expect(tabAuthStorage.getItem(authKeyA)).not.toBeNull();
  });
});
