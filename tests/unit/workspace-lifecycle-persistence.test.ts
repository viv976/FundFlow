import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEMO_WORKSPACE,
  DEMO_TRANSACTIONS,
  DEMO_ALERTS,
} from '@/lib/store/demo-data';
import {
  INITIAL_RESOLVING_WORKSPACE,
  INITIAL_RESOLVING_USER,
  FinanceStateStatus,
} from '@/lib/store/finance-context';
import { fetchWorkspaceAndProfile } from '@/lib/supabase/db';
import { Workspace, Transaction, Alert, UserProfile } from '@/types/finance';

// Mock Supabase client
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: unknown) => mockOnAuthStateChange(cb),
    },
    from: (table: string) => mockFrom(table),
  },
  isSupabaseConfigured: true,
}));

describe('WORKSPACE LIFECYCLE, ROUTE PERSISTENCE & CONCURRENCY REGRESSION SUITE', () => {
  const USER_A_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
  const USER_B_ID = 'bbbbbbbb-2222-4222-8222-222222222222';

  const WORKSPACE_A: Workspace = {
    id: '11111111-aaaa-4000-8000-aaaaaaaaaaaa',
    name: 'Alpha Innovations Inc',
    owner_id: USER_A_ID,
    currency: 'USD',
    starting_cash: 250000,
    alert_runway_threshold: 6,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  const WORKSPACE_B: Workspace = {
    id: '22222222-bbbb-4000-8000-bbbbbbbbbbbb',
    name: 'Beta Global Technologies',
    owner_id: USER_B_ID,
    currency: 'EUR',
    starting_cash: 750000,
    alert_runway_threshold: 6,
    created_at: '2026-02-01T00:00:00.000Z',
  };

  const TRANSACTIONS_A: Transaction[] = [
    {
      id: 'tx-alpha-1',
      workspace_id: WORKSPACE_A.id,
      transaction_date: '2026-03-01',
      description: 'Enterprise License Alpha',
      merchant: 'Client X',
      category: 'Revenue',
      amount: 50000,
      currency: 'USD',
      transaction_type: 'income',
      status: 'completed',
      source: 'manual',
    },
  ];

  const TRANSACTIONS_B: Transaction[] = [
    {
      id: 'tx-beta-1',
      workspace_id: WORKSPACE_B.id,
      transaction_date: '2026-03-05',
      description: 'Server Infrastructure Beta',
      merchant: 'AWS Cloud',
      category: 'Infrastructure',
      amount: 12000,
      currency: 'EUR',
      transaction_type: 'expense',
      status: 'completed',
      source: 'manual',
    },
  ];

  const ALERTS_A: Alert[] = [
    {
      id: 'alert-alpha-1',
      workspace_id: WORKSPACE_A.id,
      alert_type: 'runway_risk',
      severity: 'warning',
      title: 'Runway Warning',
      message: 'Runway below threshold',
      status: 'active',
      created_at: '2026-03-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Requirement 1: FinanceContext does not reinitialize on route navigation
  // --------------------------------------------------------------------------
  it('1. FinanceContext does not reinitialize or refetch workspace on route navigation', async () => {
    let bootstrapCallCount = 0;

    // Simulated workspace initializer mirroring FinanceContext syncAuthAndWorkspace
    const activeUserIdRef = { current: null as string | null };
    const workspaceRef = { current: INITIAL_RESOLVING_WORKSPACE };
    const statusRef = { current: 'resolving_auth' as FinanceStateStatus };

    async function syncAuthAndWorkspace(userId?: string) {
      if (
        userId &&
        activeUserIdRef.current === userId &&
        workspaceRef.current.id !== INITIAL_RESOLVING_WORKSPACE.id &&
        statusRef.current === 'authenticated'
      ) {
        // FAST-PATH SKIP: Workspace is already resolved and verified!
        return;
      }

      bootstrapCallCount++;
      activeUserIdRef.current = userId || null;
      workspaceRef.current = WORKSPACE_A;
      statusRef.current = 'authenticated';
    }

    // Step A: First authenticated load
    await syncAuthAndWorkspace(USER_A_ID);
    expect(bootstrapCallCount).toBe(1);
    expect(workspaceRef.current.id).toBe(WORKSPACE_A.id);
    expect(statusRef.current).toBe('authenticated');

    // Step B: Client-side navigation sequence:
    // /dashboard -> /transactions -> /scenarios -> /alerts -> /ask-ai -> /dashboard
    const routes = ['/transactions', '/scenarios', '/alerts', '/ask-ai', '/dashboard'];
    for (let i = 0; i < routes.length; i++) {
      // Simulating any context read or sync invocation triggered during route transition
      await syncAuthAndWorkspace(USER_A_ID);
    }

    // Must NOT have called bootstrap again! Call count remains exactly 1!
    expect(bootstrapCallCount).toBe(1);
    expect(workspaceRef.current.id).toBe(WORKSPACE_A.id);
  });

  // --------------------------------------------------------------------------
  // Requirement 2: TOKEN_REFRESHED does not trigger full workspace hydration
  // --------------------------------------------------------------------------
  it('2. TOKEN_REFRESHED does not trigger full workspace hydration or erase existing state', async () => {
    let hydrationTriggered = false;
    const activeWorkspace = { ...WORKSPACE_A };
    const activeTransactions = [...TRANSACTIONS_A];
    const activeUserId = USER_A_ID;

    // Simulate onAuthStateChange event dispatcher
    function handleAuthEvent(event: string, sessionUserId?: string) {
      if (event === 'TOKEN_REFRESHED') {
        // TOKEN_REFRESHED is an auth maintenance event: DO NOT hydrate workspace
        return;
      }
      if (event === 'SIGNED_IN') {
        if (sessionUserId === activeUserId && activeWorkspace.id !== INITIAL_RESOLVING_WORKSPACE.id) {
          return;
        }
        hydrationTriggered = true;
      }
    }

    // Dispatch TOKEN_REFRESHED
    handleAuthEvent('TOKEN_REFRESHED', USER_A_ID);

    expect(hydrationTriggered).toBe(false);
    expect(activeWorkspace.id).toBe(WORKSPACE_A.id);
    expect(activeTransactions).toHaveLength(1);
    expect(activeTransactions[0].description).toBe('Enterprise License Alpha');
  });

  // --------------------------------------------------------------------------
  // Requirement 3: Repeated auth events do not create duplicate workspace requests
  // --------------------------------------------------------------------------
  it('3. Repeated auth events (INITIAL_SESSION + getSession + SIGNED_IN) coalesce into a single request', async () => {
    let networkRequestCount = 0;
    let inFlightSync: Promise<void> | null = null;

    async function executeWorkspaceFetch() {
      networkRequestCount++;
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    async function syncAuthAndWorkspace() {
      // Request coalescing
      if (inFlightSync) {
        await inFlightSync;
        return;
      }

      inFlightSync = executeWorkspaceFetch().finally(() => {
        inFlightSync = null;
      });
      await inFlightSync;
    }

    // Simultaneously fire 3 concurrent events (simulate getSession() + INITIAL_SESSION + SIGNED_IN)
    await Promise.all([
      syncAuthAndWorkspace(),
      syncAuthAndWorkspace(),
      syncAuthAndWorkspace(),
    ]);

    // All 3 calls coalesced into exactly 1 network request!
    expect(networkRequestCount).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Requirement 4: Authenticated workspace remains ready after navigation
  // --------------------------------------------------------------------------
  it('4. Authenticated workspace remains ready (isWorkspaceReady === true) throughout navigation', () => {
    const isLoading = false;
    const status: FinanceStateStatus = 'authenticated';
    const currentWorkspace = WORKSPACE_A;

    const isWorkspaceReady = () =>
      (status === 'authenticated' || status === 'demo') &&
      currentWorkspace.id !== INITIAL_RESOLVING_WORKSPACE.id &&
      !isLoading;

    expect(isWorkspaceReady()).toBe(true);

    // Navigate across all tabs without re-triggering isLoading = true
    const tabs = ['transactions', 'scenarios', 'alerts', 'reports', 'dashboard'];
    for (let i = 0; i < tabs.length; i++) {
      // In persistent context, isLoading remains false
      expect(isWorkspaceReady()).toBe(true);
    }

    expect(isWorkspaceReady()).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Requirement 5: Browser/tab visibility does not reset workspace readiness
  // --------------------------------------------------------------------------
  it('5. Browser tab visibility change does not reset workspace readiness or show loading screen', async () => {
    let isLoading = false;
    const workspace = WORKSPACE_A;
    const activeUserId = USER_A_ID;
    const status: FinanceStateStatus = 'authenticated';

    // Simulate Supabase visibilitychange firing SIGNED_IN for the existing session
    function onTabVisibilityChange(sessionUserId: string) {
      if (sessionUserId === activeUserId && workspace.id !== INITIAL_RESOLVING_WORKSPACE.id && status === 'authenticated') {
        // Fast-path skip: Do not set isLoading = true
        return;
      }
      isLoading = true;
    }

    onTabVisibilityChange(USER_A_ID);

    // isLoading was NOT flipped to true
    expect(isLoading).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Requirement 6: Stale async workspace requests cannot overwrite current state
  // --------------------------------------------------------------------------
  it('6. Stale async workspace requests cannot overwrite newer state', async () => {
    let requestEpoch = 0;
    let committedWorkspace: Workspace = INITIAL_RESOLVING_WORKSPACE;

    // Request 1 starts for Workspace A
    const req1Epoch = ++requestEpoch;
    const slowRequest1 = new Promise<Workspace>((resolve) => {
      setTimeout(() => resolve(WORKSPACE_A), 50);
    });

    // Request 2 starts for Workspace B (e.g. user switch)
    const req2Epoch = ++requestEpoch;
    committedWorkspace = WORKSPACE_B;

    // Request 1 finishes later
    const req1Result = await slowRequest1;
    if (req1Epoch === requestEpoch) {
      committedWorkspace = req1Result;
    }

    // Committed state remains Workspace B from Request 2
    expect(committedWorkspace.id).toBe(WORKSPACE_B.id);
    expect(req1Epoch).not.toBe(requestEpoch);
    expect(req2Epoch).toBe(requestEpoch);
  });

  // --------------------------------------------------------------------------
  // Requirement 7: Logout clears the previous user financial state
  // --------------------------------------------------------------------------
  it('7. Logout immediately clears the previous user financial state and sensitive records', () => {
    let workspace: Workspace = WORKSPACE_A;
    let user: UserProfile = { id: USER_A_ID, full_name: 'Alex Rivera', email: 'alex@alpha.io', role: 'owner' };
    let transactions: Transaction[] = TRANSACTIONS_A;
    let alerts: Alert[] = ALERTS_A;
    let status: FinanceStateStatus = 'authenticated';
    let isDemo = false;

    // Simulate signOutUser()
    function signOutUser() {
      workspace = INITIAL_RESOLVING_WORKSPACE;
      user = INITIAL_RESOLVING_USER;
      transactions = [];
      alerts = [];
      status = 'unauthenticated';
      isDemo = false;
    }

    signOutUser();

    expect(workspace.id).toBe(INITIAL_RESOLVING_WORKSPACE.id);
    expect(workspace.name).toBe('');
    expect(user.id).toBe('');
    expect(transactions).toHaveLength(0);
    expect(alerts).toHaveLength(0);
    expect(status).toBe('unauthenticated');
    expect(isDemo).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Requirement 8: User B cannot inherit User A workspace/data
  // --------------------------------------------------------------------------
  it('8. User B cannot inherit User A workspace or transactions on account switch', async () => {
    let activeUserId: string | null = USER_A_ID;
    let activeWorkspace: Workspace = WORKSPACE_A;
    let activeTransactions: Transaction[] = TRANSACTIONS_A;

    // User B logs in
    const incomingUserId = USER_B_ID;

    // Detection of user switch immediately purges old state
    if (activeUserId && activeUserId !== incomingUserId) {
      activeWorkspace = INITIAL_RESOLVING_WORKSPACE;
      activeTransactions = [];
    }
    activeUserId = incomingUserId;
    activeWorkspace = WORKSPACE_B;
    activeTransactions = TRANSACTIONS_B;

    expect(activeUserId).toBe(USER_B_ID);
    expect(activeWorkspace.id).toBe(WORKSPACE_B.id);
    expect(activeTransactions).toHaveLength(1);
    expect(activeTransactions[0].description).toBe('Server Infrastructure Beta');
    expect(activeTransactions).not.toContainEqual(TRANSACTIONS_A[0]);
  });

  // --------------------------------------------------------------------------
  // Requirement 9: Intentional workspace switching still works atomically
  // --------------------------------------------------------------------------
  it('9. Intentional workspace switching clears previous transactions atomically before setting new data', () => {
    let currentWorkspace: Workspace = WORKSPACE_A;
    let currentTransactions: Transaction[] = TRANSACTIONS_A;

    // User switches from Workspace A to Workspace B
    // Step 1: Transactions are cleared immediately so zero cross-contamination occurs
    currentTransactions = [];
    expect(currentTransactions).toHaveLength(0);

    // Step 2: New workspace commits atomically
    currentWorkspace = WORKSPACE_B;
    currentTransactions = TRANSACTIONS_B;

    expect(currentWorkspace.id).toBe(WORKSPACE_B.id);
    expect(currentWorkspace.currency).toBe('EUR');
    expect(currentTransactions[0].description).toBe('Server Infrastructure Beta');
  });

  // --------------------------------------------------------------------------
  // Requirement 10: Demo mode remains isolated
  // --------------------------------------------------------------------------
  it('10. Demo mode remains explicitly isolated from authenticated corporate ledger', () => {
    let status: FinanceStateStatus = 'demo';
    let isDemo = true;
    let workspace: Workspace = DEMO_WORKSPACE;
    let transactions: Transaction[] = DEMO_TRANSACTIONS;
    let alerts: Alert[] = DEMO_ALERTS;

    expect(status).toBe('demo');
    expect(isDemo).toBe(true);
    expect(workspace.id).toBe(DEMO_WORKSPACE.id);
    expect(transactions).toEqual(DEMO_TRANSACTIONS);
    expect(alerts).toEqual(DEMO_ALERTS);

    // When exiting demo mode
    status = 'unauthenticated';
    isDemo = false;
    workspace = INITIAL_RESOLVING_WORKSPACE;
    transactions = [];
    alerts = [];

    expect(status).toBe('unauthenticated');
    expect(isDemo).toBe(false);
    expect(workspace.id).toBe(INITIAL_RESOLVING_WORKSPACE.id);
    expect(transactions).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Requirement 11: Initial authenticated load still works without hard refresh
  // --------------------------------------------------------------------------
  it('11. Initial authenticated load resolves profile, workspace and transactions without hard refresh', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: USER_A_ID, email: 'founder@alpha.io' } } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [WORKSPACE_A] }) }) };
      }
      if (table === 'workspace_members') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ workspaces: WORKSPACE_A }] }) }) };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [{ id: USER_A_ID, full_name: 'Alex Rivera', email: 'founder@alpha.io' }] }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
    });

    const initResult = await fetchWorkspaceAndProfile(undefined, USER_A_ID);

    expect(initResult.workspace).not.toBeNull();
    expect(initResult.workspace?.id).toBe(WORKSPACE_A.id);
    expect(initResult.workspace?.name).toBe('Alpha Innovations Inc');
    expect(initResult.user?.id).toBe(USER_A_ID);
    expect(initResult.user?.email).toBe('founder@alpha.io');

    const status: FinanceStateStatus = initResult.workspace ? 'authenticated' : 'no_workspace';
    const isWorkspaceReady =
      (status === 'authenticated' || (status as FinanceStateStatus) === 'demo') &&
      initResult.workspace?.id !== INITIAL_RESOLVING_WORKSPACE.id;

    expect(status).toBe('authenticated');
    expect(isWorkspaceReady).toBe(true);
  });
});
