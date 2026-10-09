import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://kdfntfwstouvabavpcjd.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Tab-scoped authentication session storage.
 * By default, Supabase stores sessions in shared localStorage, causing any login in Tab B
 * to overwrite the active session in Tab A.
 *
 * Using sessionStorage with a stable per-tab identifier guarantees:
 * 1. Each browser tab maintains an isolated authentication session.
 * 2. Logging into Account B in Tab B does not overwrite Account A in Tab A.
 * 3. Refreshing Tab A restores Account A from Tab A's sessionStorage.
 * 4. Refreshing Tab B restores Account B from Tab B's sessionStorage.
 * 5. Multi-tab BroadcastChannel crosstalk is partitioned per tab session.
 */
export function getTabSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = window.sessionStorage.getItem('fundflow_tab_session_id_v1');
    if (!id) {
      id = 'tab_' + Math.random().toString(36).substring(2, 10);
      window.sessionStorage.setItem('fundflow_tab_session_id_v1', id);
    }
    return id;
  } catch {
    return 'fallback_tab';
  }
}

export const tabAuthStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {}
  },
};

export const tabStorageKey = typeof window !== 'undefined' ? `sb_auth_token_${getTabSessionId()}` : 'sb_auth_token_server';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'dummy-anon-key-unconfigured',
  {
    auth: {
      storage: typeof window !== 'undefined' ? tabAuthStorage : undefined,
      storageKey: tabStorageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

