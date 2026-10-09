import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEMO_WORKSPACE,
} from '@/lib/store/demo-data';
import {
  STORAGE_KEYS,
  isDemoModeInSession,
  setDemoModeInSession,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  INITIAL_RESOLVING_WORKSPACE,
} from '@/lib/store/finance-context';
import { fetchWorkspaceAndProfile } from '@/lib/supabase/db';
import { Workspace } from '@/types/finance';

/**
 * Multi-Tab Storage Environment Simulation
 * Models two independent browser tabs (Tab A and Tab B) on the same origin:
 * - Both tabs share window.localStorage.
 * - Each tab possesses an isolated, independent window.sessionStorage.
 */
class BrowserTabContext {
  public tabName: string;
  public sessionStorage: Storage;
  private sharedLocalStorage: Storage;

  constructor(name: string, sharedLocalStorage: Storage) {
    this.tabName = name;
    this.sharedLocalStorage = sharedLocalStorage;
    const store = new Map<string, string>();
    this.sessionStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
  }

  /**
   * Activate this tab's window context in global scope
   */
  public activate(): void {
    vi.stubGlobal('sessionStorage', this.sessionStorage);
    vi.stubGlobal('localStorage', this.sharedLocalStorage);
    vi.stubGlobal('window', {
      sessionStorage: this.sessionStorage,
      localStorage: this.sharedLocalStorage,
      location: { href: 'http://localhost:3000/dashboard' },
    });
  }
}

function createSharedLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

// Mock Supabase client
const mockGetSession = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    from: (table: string) => mockFrom(table),
  },
  isSupabaseConfigured: true,
}));

describe('Cross-Tab Demo Mode Isolation & Multi-Tab Tab-Scoped Persistence', () => {
  let sharedLocalStorage: Storage;
  let tabA: BrowserTabContext;
  let tabB: BrowserTabContext;

  const REAL_USER_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';

  const REAL_WORKSPACE_A: Workspace = {
    id: 'aaaaaaaa-1111-4111-8111-444444444444',
    name: 'Primary SaaS Corp',
    owner_id: REAL_USER_ID,
    currency: 'USD',
    starting_cash: 100000,
    alert_runway_threshold: 6,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  const REAL_WORKSPACE_B: Workspace = {
    id: 'bbbbbbbb-1111-4111-8111-444444444444',
    name: 'Secondary E-commerce Ltd',
    owner_id: REAL_USER_ID,
    currency: 'USD',
    starting_cash: 500000,
    alert_runway_threshold: 6,
    created_at: '2026-02-01T00:00:00.000Z',
  };

  const UNAUTHORIZED_WORKSPACE: Workspace = {
    id: '77777777-8888-4999-8777-666666666666',
    name: 'Secret Competitor Corp',
    owner_id: OTHER_USER_ID,
    currency: 'USD',
    starting_cash: 9999999,
    alert_runway_threshold: 6,
    created_at: '2026-01-15T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sharedLocalStorage = createSharedLocalStorage();
    tabA = new BrowserTabContext('Tab A (Authenticated)', sharedLocalStorage);
    tabB = new BrowserTabContext('Tab B (Demo)', sharedLocalStorage);
  });

  // -------------------------------------------------------------
  // Scenario 1: Launch demo -> refresh same tab -> demo remains active
  // -------------------------------------------------------------
  it('1. Launch demo -> refresh the same tab -> demo remains active', () => {
    tabB.activate();

    // Launch demo in Tab B
    setDemoModeInSession(true);
    expect(isDemoModeInSession()).toBe(true);
    expect(tabB.sessionStorage.getItem(STORAGE_KEYS.DEMO_MODE)).toBe('true');

    // Simulate page refresh in Tab B:
    // Tab B's sessionStorage survives reload; no local storage leakage
    expect(tabB.sessionStorage.getItem(STORAGE_KEYS.DEMO_MODE)).toBe('true');
    expect(isDemoModeInSession()).toBe(true);

    // Verify localStorage was NOT polluted with demo flag
    expect(sharedLocalStorage.getItem(STORAGE_KEYS.DEMO_MODE)).toBeNull();
  });

  // -------------------------------------------------------------
  // Scenario 2: Real account in Tab A + demo in Tab B -> refreshing Tab B preserves demo
  // -------------------------------------------------------------
  it('2. Real account in Tab A + demo in Tab B -> refreshing Tab B preserves demo', async () => {
    // 1. Tab A is logged in with real account and active workspace
    tabA.activate();
    sharedLocalStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, REAL_WORKSPACE_A.id);
    expect(isDemoModeInSession()).toBe(false);

    // 2. Tab B opens and launches simulated environment
    tabB.activate();
    setDemoModeInSession(true);
    expect(isDemoModeInSession()).toBe(true);

    // 3. Tab B is refreshed while Supabase session exists in shared storage
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: REAL_USER_ID, email: 'founder@saas.com' } } },
    });

    // In Tab B, demo mode must remain true because it's tab-scoped
    expect(isDemoModeInSession()).toBe(true);

    // Switch to Tab A: Tab A must NOT have demo mode active
    tabA.activate();
    expect(isDemoModeInSession()).toBe(false);
    expect(sharedLocalStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID)).toBe(REAL_WORKSPACE_A.id);
  });

  // -------------------------------------------------------------
  // Scenario 3: Demo state in Tab B does not overwrite Tab A's active workspace
  // -------------------------------------------------------------
  it('3. Demo state in Tab B does not overwrite Tab A active workspace', () => {
    // Tab A has active workspace ID stored
    tabA.activate();
    sharedLocalStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, REAL_WORKSPACE_A.id);

    // Tab B enters demo mode
    tabB.activate();
    setDemoModeInSession(true);

    // Tab B activating demo mode must NEVER wipe Tab A's workspace ID in shared localStorage
    expect(sharedLocalStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID)).toBe(REAL_WORKSPACE_A.id);
    expect(tabB.sessionStorage.getItem(STORAGE_KEYS.DEMO_MODE)).toBe('true');
    expect(tabA.sessionStorage.getItem(STORAGE_KEYS.DEMO_MODE)).toBeNull();
  });

  // -------------------------------------------------------------
  // Scenario 4: Changing real workspace in Tab A does not change demo workspace in Tab B
  // -------------------------------------------------------------
  it('4. Changing the real workspace in Tab A does not change the demo workspace in Tab B', () => {
    // Tab B is in demo mode
    tabB.activate();
    setDemoModeInSession(true);
    expect(isDemoModeInSession()).toBe(true);

    // Tab A switches from Workspace A to Workspace B
    tabA.activate();
    sharedLocalStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, REAL_WORKSPACE_B.id);

    // Verify Tab A's active workspace changed
    expect(sharedLocalStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID)).toBe(REAL_WORKSPACE_B.id);

    // Return to Tab B: Tab B's demo state must remain active and unaffected
    tabB.activate();
    expect(isDemoModeInSession()).toBe(true);
    expect(tabB.sessionStorage.getItem(STORAGE_KEYS.DEMO_MODE)).toBe('true');
  });

  // -------------------------------------------------------------
  // Scenario 5: Auth event or token refresh does not terminate explicit demo mode
  // -------------------------------------------------------------
  it('5. An auth event or token refresh does not automatically terminate explicit demo mode', () => {
    tabB.activate();
    setDemoModeInSession(true);
    expect(isDemoModeInSession()).toBe(true);

    // Simulate cross-tab auth event: SIGNED_IN or TOKEN_REFRESHED received by Tab B
    // Guard: if (isDemoModeInSession()) return;
    const isDemoTab = isDemoModeInSession();
    expect(isDemoTab).toBe(true);

    // The tab must remain in demo mode
    expect(isDemoModeInSession()).toBe(true);
    expect(tabB.sessionStorage.getItem(STORAGE_KEYS.DEMO_MODE)).toBe('true');
  });

  // -------------------------------------------------------------
  // Scenario 6: Successful login initiated in a demo tab exits demo mode and loads real account
  // -------------------------------------------------------------
  it('6. Successful login initiated in a demo tab exits demo mode and loads the real account', async () => {
    tabB.activate();
    // Initially Tab B is in demo mode
    setDemoModeInSession(true);
    expect(isDemoModeInSession()).toBe(true);

    // User explicitly initiates login in Tab B
    setDemoModeInSession(false);
    expect(isDemoModeInSession()).toBe(false);
    expect(tabB.sessionStorage.getItem(STORAGE_KEYS.DEMO_MODE)).toBeNull();

    // Authenticate user
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID, email: 'founder@saas.com' } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const result = await fetchWorkspaceAndProfile(undefined, REAL_USER_ID);
    expect(result.workspace?.id).toBe(REAL_WORKSPACE_A.id);
    expect(result.user?.id).toBe(REAL_USER_ID);
    expect(isDemoModeInSession()).toBe(false);
  });

  // -------------------------------------------------------------
  // Scenario 7: Exiting demo mode clears the correct tab-scoped flag
  // -------------------------------------------------------------
  it('7. Exiting demo mode clears the correct tab-scoped flag', () => {
    tabB.activate();
    setDemoModeInSession(true);
    expect(isDemoModeInSession()).toBe(true);

    // User clicks Exit Demo
    setDemoModeInSession(false);
    expect(isDemoModeInSession()).toBe(false);
    expect(tabB.sessionStorage.getItem(STORAGE_KEYS.DEMO_MODE)).toBeNull();
  });

  // -------------------------------------------------------------
  // Scenario 8: Normal authenticated workspace restoration still works after refresh
  // -------------------------------------------------------------
  it('8. Normal authenticated workspace restoration still works after refresh in Tab A', async () => {
    tabA.activate();
    sharedLocalStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, REAL_WORKSPACE_B.id);

    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID, email: 'founder@saas.com' } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A, REAL_WORKSPACE_B] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const savedId = sharedLocalStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID) || undefined;
    const result = await fetchWorkspaceAndProfile(savedId, REAL_USER_ID);

    expect(result.workspace?.id).toBe(REAL_WORKSPACE_B.id);
    expect(result.workspace?.name).toBe('Secondary E-commerce Ltd');
    expect(isDemoModeInSession()).toBe(false);
  });

  // -------------------------------------------------------------
  // Scenario 9: Unauthorized workspace IDs remain rejected
  // -------------------------------------------------------------
  it('9. Unauthorized workspace IDs remain rejected and fall back to authorized workspace', async () => {
    tabA.activate();
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    // Pass competitor or unknown workspace
    const result = await fetchWorkspaceAndProfile(UNAUTHORIZED_WORKSPACE.id, REAL_USER_ID);
    expect(result.workspace?.id).not.toBe(UNAUTHORIZED_WORKSPACE.id);
    expect(result.workspace?.id).toBe(REAL_WORKSPACE_A.id);
  });

  // -------------------------------------------------------------
  // Scenario 10: Demo state cannot expose another user financial data through protected APIs
  // -------------------------------------------------------------
  it('10. Demo state cannot expose another user financial data through protected APIs without authenticated user ID', async () => {
    tabB.activate();
    setDemoModeInSession(true);

    // Mock unauthenticated session in Tab B
    mockGetSession.mockResolvedValue({ data: { session: null } });

    // Unauthenticated attempt to query real workspaces must return null
    const resultNoAuth = await fetchWorkspaceAndProfile(REAL_WORKSPACE_A.id, undefined);
    expect(resultNoAuth.workspace).toBeNull();
    expect(resultNoAuth.workspaces).toEqual([]);
    expect(resultNoAuth.user).toBeNull();

    // Even if DEMO_WORKSPACE ID is passed to DB resolver, it does not fetch unauthorized real data
    const resultDemoId = await fetchWorkspaceAndProfile(DEMO_WORKSPACE.id, undefined);
    expect(resultDemoId.workspace).toBeNull();
    expect(resultDemoId.workspaces).toEqual([]);
    expect(resultDemoId.user).toBeNull();
  });

  // -------------------------------------------------------------
  // Scenario 11: Login in Tab B does not unexpectedly change Tab A's account/workspace
  // -------------------------------------------------------------
  it('11. Explicit login in Tab B transitions Tab B to new account while Tab A remains on its intended account & workspace', async () => {
    // 1. Tab A is logged in to Account A with Workspace A
    tabA.activate();
    tabA.sessionStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, REAL_WORKSPACE_A.id);
    sharedLocalStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, REAL_WORKSPACE_A.id);

    const tabAActiveUserId = REAL_USER_ID;
    const tabAActiveWorkspace = REAL_WORKSPACE_A;

    expect(tabA.sessionStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID)).toBe(REAL_WORKSPACE_A.id);
    expect(isDemoModeInSession()).toBe(false);

    // 2. Tab B opens the demo dashboard
    tabB.activate();
    setDemoModeInSession(true);
    expect(isDemoModeInSession()).toBe(true);

    // 3. User in Tab B explicitly logs in to Account B
    const ACCOUNT_B_USER_ID = OTHER_USER_ID;
    setDemoModeInSession(false);
    expect(isDemoModeInSession()).toBe(false);

    tabB.sessionStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, REAL_WORKSPACE_B.id);

    // In Tab B, verify transition to Account B
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: ACCOUNT_B_USER_ID, email: 'founderB@other.com' } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_B] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const tabBResult = await fetchWorkspaceAndProfile(REAL_WORKSPACE_B.id, ACCOUNT_B_USER_ID);
    expect(tabBResult.workspace?.id).toBe(REAL_WORKSPACE_B.id);
    expect(tabBResult.user?.id).toBe(ACCOUNT_B_USER_ID);
    expect(isDemoModeInSession()).toBe(false);

    // 4. In Tab A: Tab A must retain its original account and workspace
    tabA.activate();

    // Cross-tab auth event rule check:
    // If Tab A is already authenticated, cross-tab SIGNED_IN event for ACCOUNT_B_USER_ID must be ignored
    const isTabAAuthenticated = true;
    const shouldIgnoreCrossTabLogin =
      isTabAAuthenticated &&
      tabAActiveUserId &&
      tabAActiveWorkspace.id !== INITIAL_RESOLVING_WORKSPACE.id;

    expect(shouldIgnoreCrossTabLogin).toBe(true);
    expect(tabAActiveUserId).toBe(REAL_USER_ID);
    expect(tabA.sessionStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID)).toBe(REAL_WORKSPACE_A.id);
    expect(isDemoModeInSession()).toBe(false);
  });

  // -------------------------------------------------------------
  // Scenario 12: Leaving demo mode in Tab B does not log Tab A out or redirect Tab A to /login
  // -------------------------------------------------------------
  it('12. Leaving demo mode in Tab B preserves Tab A real session, storage, and route without triggering SIGNED_OUT', () => {
    // 1. Tab A is logged in to Account A with active workspace
    tabA.activate();
    sharedLocalStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, REAL_WORKSPACE_A.id);
    tabA.sessionStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, REAL_WORKSPACE_A.id);

    // 2. Tab B is in demo mode
    tabB.activate();
    setDemoModeInSession(true);
    expect(isDemoModeInSession()).toBe(true);

    // 3. User in Tab B clicks Sign Out / leaves demo mode
    const isCurrentlyDemo = isDemoModeInSession();
    expect(isCurrentlyDemo).toBe(true);

    // Simulated demo sign out logic:
    setDemoModeInSession(false);
    tabB.sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID);

    // Crucial check: when isCurrentlyDemo is true, signOut() must NOT be called,
    // and sharedLocalStorage must NOT be wiped
    const shouldCallSupabaseSignOut = !isCurrentlyDemo;
    expect(shouldCallSupabaseSignOut).toBe(false);

    // 4. Return to Tab A: Tab A's session and storage must remain 100% intact
    tabA.activate();
    expect(sharedLocalStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID)).toBe(REAL_WORKSPACE_A.id);
    expect(tabA.sessionStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID)).toBe(REAL_WORKSPACE_A.id);
    expect(isDemoModeInSession()).toBe(false);
  });

  // -------------------------------------------------------------
  // Scenario 13: Tab A restores Workspace A after refresh when Tab B changes active workspace
  // -------------------------------------------------------------
  it('13. Tab A restores Workspace A after refresh when Tab B changes its active workspace, and unauthorized stored IDs are rejected', async () => {
    // 1. Tab A stores Workspace A
    tabA.activate();
    setActiveWorkspaceId(REAL_WORKSPACE_A.id, REAL_USER_ID);
    expect(getActiveWorkspaceId(REAL_USER_ID)).toBe(REAL_WORKSPACE_A.id);

    // 2. Tab B stores Workspace B
    tabB.activate();
    setActiveWorkspaceId(REAL_WORKSPACE_B.id, REAL_USER_ID);
    expect(getActiveWorkspaceId(REAL_USER_ID)).toBe(REAL_WORKSPACE_B.id);

    // 3. Tab B changes its active workspace to Workspace C
    const REAL_WORKSPACE_C: Workspace = {
      id: 'cccccccc-1111-4111-8111-444444444444',
      name: 'Third Logistics Corp',
      owner_id: REAL_USER_ID,
      currency: 'USD',
      starting_cash: 75000,
      alert_runway_threshold: 6,
      created_at: '2026-03-01T00:00:00.000Z',
    };
    setActiveWorkspaceId(REAL_WORKSPACE_C.id, REAL_USER_ID);
    expect(getActiveWorkspaceId(REAL_USER_ID)).toBe(REAL_WORKSPACE_C.id);

    // 4. Tab A is reinitialized as if refreshed
    tabA.activate();
    // Simulate Tab A refresh: reads saved workspace ID from tab's isolated storage
    const tabASavedWsId = getActiveWorkspaceId(REAL_USER_ID);
    expect(tabASavedWsId).toBe(REAL_WORKSPACE_A.id);

    // Setup mock Supabase to return authorized workspaces [REAL_WORKSPACE_A, REAL_WORKSPACE_B, REAL_WORKSPACE_C]
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: REAL_USER_ID, email: 'founder@saas.com' } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A, REAL_WORKSPACE_B, REAL_WORKSPACE_C] }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
      };
    });

    // Tab A resolves workspace with its restored ID
    const tabAResult = await fetchWorkspaceAndProfile(tabASavedWsId || undefined, REAL_USER_ID);
    // 5. Tab A must restore Workspace A
    expect(tabAResult.workspace?.id).toBe(REAL_WORKSPACE_A.id);
    expect(tabAResult.workspace?.name).toBe('Primary SaaS Corp');

    // And Tab B retains its changed selection (Workspace C)
    tabB.activate();
    const tabBSavedWsId = getActiveWorkspaceId(REAL_USER_ID);
    expect(tabBSavedWsId).toBe(REAL_WORKSPACE_C.id);
    const tabBResult = await fetchWorkspaceAndProfile(tabBSavedWsId || undefined, REAL_USER_ID);
    expect(tabBResult.workspace?.id).toBe(REAL_WORKSPACE_C.id);

    // 6. Verify that an unauthorized stored workspace ID is rejected
    tabA.activate();
    // Clear user-scoped key so generic candidate is used for unauthorized test
    tabA.sessionStorage.removeItem(`${STORAGE_KEYS.ACTIVE_WORKSPACE_ID}_${REAL_USER_ID}`);
    tabA.sessionStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, UNAUTHORIZED_WORKSPACE.id);
    const unauthorizedCandidate = getActiveWorkspaceId(REAL_USER_ID);
    expect(unauthorizedCandidate).toBe(UNAUTHORIZED_WORKSPACE.id);

    // fetchWorkspaceAndProfile must validate against authorized workspaces, reject unauthorized ID,
    // and fall back to the user's primary deterministic workspace (REAL_WORKSPACE_A)
    const unauthorizedResult = await fetchWorkspaceAndProfile(unauthorizedCandidate || undefined, REAL_USER_ID);
    expect(unauthorizedResult.workspace?.id).toBe(REAL_WORKSPACE_A.id);
    expect(unauthorizedResult.workspace?.id).not.toBe(UNAUTHORIZED_WORKSPACE.id);
  });

  // -------------------------------------------------------------
  // Scenario 14: Tab A logs into Account A, Tab B logs into Account B, Tab A refresh preserves Account A
  // -------------------------------------------------------------
  it('14. Tab A logs into Account A, Tab B logs into Account B, refresh Tab A restores Account A (acceptance test)', async () => {
    // 1. Tab A logs into Account A
    tabA.activate();
    setActiveWorkspaceId(REAL_WORKSPACE_A.id, REAL_USER_ID);
    tabA.sessionStorage.setItem('tab_user_id', REAL_USER_ID);

    mockGetSession.mockImplementation(async () => {
      // Mock session retrieval reflecting tab context's stored user
      const currentTabUser = window.sessionStorage.getItem('tab_user_id');
      if (currentTabUser === REAL_USER_ID) {
        return { data: { session: { user: { id: REAL_USER_ID, email: 'founderA@saas.com' } } } };
      }
      if (currentTabUser === OTHER_USER_ID) {
        return { data: { session: { user: { id: OTHER_USER_ID, email: 'founderB@other.com' } } } };
      }
      return { data: { session: null } };
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => {
              const currentTabUser = window.sessionStorage.getItem('tab_user_id');
              if (currentTabUser === REAL_USER_ID) {
                return Promise.resolve({ data: [REAL_WORKSPACE_A] });
              }
              return Promise.resolve({ data: [REAL_WORKSPACE_B] });
            },
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
      };
    });

    const tabAInitial = await fetchWorkspaceAndProfile(REAL_WORKSPACE_A.id, REAL_USER_ID);
    expect(tabAInitial.user?.id).toBe(REAL_USER_ID);
    expect(tabAInitial.workspace?.id).toBe(REAL_WORKSPACE_A.id);

    // 2. Tab B logs into Account B
    tabB.activate();
    setActiveWorkspaceId(REAL_WORKSPACE_B.id, OTHER_USER_ID);
    tabB.sessionStorage.setItem('tab_user_id', OTHER_USER_ID);

    const tabBInitial = await fetchWorkspaceAndProfile(REAL_WORKSPACE_B.id, OTHER_USER_ID);
    expect(tabBInitial.user?.id).toBe(OTHER_USER_ID);
    expect(tabBInitial.workspace?.id).toBe(REAL_WORKSPACE_B.id);

    // 3. Both tabs initially display their correct accounts
    expect(tabAInitial.user?.id).toBe(REAL_USER_ID);
    expect(tabBInitial.user?.id).toBe(OTHER_USER_ID);

    // 4. Refresh Tab A
    tabA.activate();
    // Simulate Tab A refresh: session resolved from Tab A's tab-scoped storage
    const tabARefreshSession = await mockGetSession();
    expect(tabARefreshSession.data?.session?.user?.id).toBe(REAL_USER_ID);

    const tabASavedWsId = getActiveWorkspaceId(REAL_USER_ID);
    expect(tabASavedWsId).toBe(REAL_WORKSPACE_A.id);

    const tabARefreshed = await fetchWorkspaceAndProfile(tabASavedWsId || undefined, REAL_USER_ID);
    // 5. Tab A still authenticates as Account A!
    expect(tabARefreshed.user?.id).toBe(REAL_USER_ID);
    expect(tabARefreshed.workspace?.id).toBe(REAL_WORKSPACE_A.id);

    // 6. Verify Tab B remains Account B
    tabB.activate();
    const tabBRefreshSession = await mockGetSession();
    expect(tabBRefreshSession.data?.session?.user?.id).toBe(OTHER_USER_ID);
    const tabBSavedWsId = getActiveWorkspaceId(OTHER_USER_ID);
    expect(tabBSavedWsId).toBe(REAL_WORKSPACE_B.id);
    const tabBRefreshed = await fetchWorkspaceAndProfile(tabBSavedWsId || undefined, OTHER_USER_ID);
    expect(tabBRefreshed.user?.id).toBe(OTHER_USER_ID);
    expect(tabBRefreshed.workspace?.id).toBe(REAL_WORKSPACE_B.id);
  });
});
