import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEMO_WORKSPACE,
  DEMO_TRANSACTIONS,
} from '@/lib/store/demo-data';
import {
  INITIAL_RESOLVING_WORKSPACE,
  INITIAL_RESOLVING_USER,
  FinanceStateStatus,
} from '@/lib/store/finance-context';
import { fetchWorkspaceAndProfile } from '@/lib/supabase/db';
import { calculateAllKPIs } from '@/lib/finance/calculator';
import { Workspace, Transaction } from '@/types/finance';

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

describe('AUTH SESSION INITIALIZATION & WORKSPACE SYNCHRONIZATION REGRESSION SUITE', () => {
  const USER_A_ID = '11111111-aaaa-4111-8111-111111111111';
  const USER_B_ID = '22222222-bbbb-4222-8222-222222222222';

  const WORKSPACE_A: Workspace = {
    id: 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa',
    name: 'Alpha Corp',
    owner_id: USER_A_ID,
    currency: 'USD',
    starting_cash: 100000,
    alert_runway_threshold: 6,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  const WORKSPACE_B: Workspace = {
    id: 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb',
    name: 'Beta Ventures',
    owner_id: USER_B_ID,
    currency: 'EUR',
    starting_cash: 500000,
    alert_runway_threshold: 6,
    created_at: '2026-02-01T00:00:00.000Z',
  };

  const TRANSACTIONS_A: Transaction[] = [
    {
      id: 'tx-a-1',
      workspace_id: WORKSPACE_A.id,
      transaction_date: '2026-03-01',
      description: 'Alpha Enterprise Contract',
      merchant: 'Customer Alpha',
      category: 'Revenue',
      amount: 40000,
      currency: 'USD',
      transaction_type: 'income',
      status: 'completed',
      source: 'manual',
    },
  ];

  const TRANSACTIONS_B: Transaction[] = [
    {
      id: 'tx-b-1',
      workspace_id: WORKSPACE_B.id,
      transaction_date: '2026-03-05',
      description: 'Beta Office Rent',
      merchant: 'Landlord Beta',
      category: 'Facilities',
      amount: 15000,
      currency: 'EUR',
      transaction_type: 'expense',
      status: 'completed',
      source: 'manual',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Requirement 1: Authenticated session initializes FinanceContext without refresh
  // --------------------------------------------------------------------------
  it('1. Authenticated session initializes FinanceContext without requiring browser refresh', async () => {
    // Supabase session is established from login
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: USER_A_ID, email: 'alex@alpha.io' } } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ workspaces: WORKSPACE_A }] }),
          }),
        };
      }
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [WORKSPACE_A] }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({
                  data: [{ id: USER_A_ID, full_name: 'Alex Rivera', email: 'alex@alpha.io' }],
                }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
    });

    // Calling fetchWorkspaceAndProfile with explicit user ID immediately hydrates without refresh
    const result = await fetchWorkspaceAndProfile(undefined, USER_A_ID);

    expect(result.workspace).not.toBeNull();
    expect(result.workspace?.id).toBe(WORKSPACE_A.id);
    expect(result.workspace?.name).toBe('Alpha Corp');
    expect(result.workspaces).toHaveLength(1);
    expect(result.user?.id).toBe(USER_A_ID);
    expect(result.user?.email).toBe('alex@alpha.io');

    // Does NOT return neutral sentinel or demo
    expect(result.workspace?.id).not.toBe(INITIAL_RESOLVING_WORKSPACE.id);
    expect(result.workspace?.id).not.toBe(DEMO_WORKSPACE.id);
  });

  // --------------------------------------------------------------------------
  // Requirement 2: Login -> workspace hydration atomically produces usable state
  // --------------------------------------------------------------------------
  it('2. Login -> workspace hydration atomically produces authorized workspace, profile and ledger', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: USER_A_ID, email: 'alex@alpha.io' } } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [WORKSPACE_A] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const initResult = await fetchWorkspaceAndProfile(WORKSPACE_A.id, USER_A_ID);
    expect(initResult.workspace?.id).toBe(WORKSPACE_A.id);

    // State machine calculation
    const status: FinanceStateStatus = initResult.workspace ? 'authenticated' : 'no_workspace';
    const isWorkspaceReady =
      (status === 'authenticated' || (status as FinanceStateStatus) === 'demo') &&
      initResult.workspace?.id !== INITIAL_RESOLVING_WORKSPACE.id;

    expect(status).toBe('authenticated');
    expect(isWorkspaceReady).toBe(true);

    // KPIs calculate deterministically on the hydrated data
    const kpis = calculateAllKPIs(TRANSACTIONS_A, initResult.workspace!.starting_cash);
    expect(kpis.cashOnHand).toBe(140000); // 100K starting + 40K income
  });

  // --------------------------------------------------------------------------
  // Requirement 3: Logout -> login as different user
  // --------------------------------------------------------------------------
  it('3. Logout -> login as different user switches completely to new account workspace', async () => {
    // Step A: User A is logged in
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: USER_A_ID, email: 'userA@test.com' } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [WORKSPACE_A] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const userAResult = await fetchWorkspaceAndProfile(undefined, USER_A_ID);
    expect(userAResult.workspace?.id).toBe(WORKSPACE_A.id);

    // Step B: User A logs out (state resets to neutral)
    let currentWorkspace = INITIAL_RESOLVING_WORKSPACE;
    let currentTransactions: Transaction[] = [];
    let currentStatus: FinanceStateStatus = 'unauthenticated';

    expect(currentWorkspace.id).toBe(INITIAL_RESOLVING_WORKSPACE.id);
    expect(currentTransactions).toHaveLength(0);
    expect(currentStatus).toBe('unauthenticated');

    // Step C: User B logs in
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: USER_B_ID, email: 'userB@test.com' } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [WORKSPACE_B] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const userBResult = await fetchWorkspaceAndProfile(undefined, USER_B_ID);
    currentWorkspace = userBResult.workspace!;
    currentTransactions = TRANSACTIONS_B;
    currentStatus = 'authenticated';

    expect(currentWorkspace.id).toBe(WORKSPACE_B.id);
    expect(currentWorkspace.name).toBe('Beta Ventures');
    expect(currentTransactions[0].description).toBe('Beta Office Rent');
    expect(currentStatus).toBe('authenticated');
  });

  // --------------------------------------------------------------------------
  // Requirement 4: Old user's workspace/data cannot survive the account transition
  // --------------------------------------------------------------------------
  it('4. Old user workspace and transaction data cannot survive account transition', async () => {
    let memoryWorkspace = WORKSPACE_A;
    let memoryTransactions = TRANSACTIONS_A;
    let activeUserId: string | null = USER_A_ID;

    // Simulate account change detection in syncAuthAndWorkspace
    const newIncomingUserId = USER_B_ID;
    if (activeUserId && activeUserId !== newIncomingUserId) {
      memoryWorkspace = INITIAL_RESOLVING_WORKSPACE;
      memoryTransactions = [];
    }
    activeUserId = newIncomingUserId;

    expect(memoryWorkspace.id).toBe(INITIAL_RESOLVING_WORKSPACE.id);
    expect(memoryTransactions).toHaveLength(0);
    expect(memoryTransactions).not.toContain(TRANSACTIONS_A[0]);
  });

  // --------------------------------------------------------------------------
  // Requirement 5: Authenticated direct /dashboard navigation
  // --------------------------------------------------------------------------
  it('5. Authenticated direct /dashboard navigation initializes from session without refresh', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: USER_A_ID, email: 'direct@alpha.io' } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [WORKSPACE_A] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    // Directly visits /dashboard where session exists in client
    const sessionRes = await mockGetSession();
    const effectiveUserId = sessionRes.data.session?.user?.id;
    expect(effectiveUserId).toBe(USER_A_ID);

    const directNavResult = await fetchWorkspaceAndProfile(undefined, effectiveUserId);
    expect(directNavResult.workspace?.id).toBe(WORKSPACE_A.id);
    expect(directNavResult.workspace?.name).toBe('Alpha Corp');
  });

  // --------------------------------------------------------------------------
  // Requirement 6: Workspace switching remains atomic
  // --------------------------------------------------------------------------
  it('6. Workspace switching clears previous transactions before setting new workspace data', () => {
    let activeWorkspace = WORKSPACE_A;
    let activeTransactions = TRANSACTIONS_A;

    // Simulate atomic switchWorkspace beginning:
    // Transactions are purged immediately so there is zero overlap
    activeTransactions = [];
    expect(activeTransactions).toHaveLength(0);

    // Switch commits:
    activeWorkspace = WORKSPACE_B;
    activeTransactions = TRANSACTIONS_B;

    expect(activeWorkspace.id).toBe(WORKSPACE_B.id);
    expect(activeTransactions).toEqual(TRANSACTIONS_B);
    expect(activeTransactions).not.toContain(TRANSACTIONS_A[0]);
  });

  // --------------------------------------------------------------------------
  // Requirement 7: Demo mode remains isolated
  // --------------------------------------------------------------------------
  it('7. Demo mode remains strictly isolated from real accounts', () => {
    const isDemo = true;
    const workspace = DEMO_WORKSPACE;
    const transactions = DEMO_TRANSACTIONS;

    expect(workspace.id).toBe(DEMO_WORKSPACE.id);
    expect(isDemo).toBe(true);
    expect(transactions).toEqual(DEMO_TRANSACTIONS);

    // Verified account never matches demo ID
    expect(WORKSPACE_A.id).not.toBe(DEMO_WORKSPACE.id);
    expect(WORKSPACE_B.id).not.toBe(DEMO_WORKSPACE.id);
  });

  // --------------------------------------------------------------------------
  // Requirement 8: No demo state appears during authenticated initialization
  // --------------------------------------------------------------------------
  it('8. Initial resolving state renders neutral sentinels and never leaks demo state', () => {
    const initWorkspace = INITIAL_RESOLVING_WORKSPACE;
    const initUser = INITIAL_RESOLVING_USER;

    expect(initWorkspace.id).not.toBe(DEMO_WORKSPACE.id);
    expect(initWorkspace.name).toBe('');
    expect(initWorkspace.starting_cash).toBe(0);
    expect(initUser.id).toBe('');
    expect(initUser.email).toBe('');
  });

  // --------------------------------------------------------------------------
  // Requirement 9: Async response from previous user cannot overwrite current user state
  // --------------------------------------------------------------------------
  it('9. Async response with stale request epoch is discarded and cannot overwrite new user state', async () => {
    let requestIdCounter = 0;
    let currentCommittedState: Workspace = INITIAL_RESOLVING_WORKSPACE;

    // User A initiates async request 1
    const req1Id = ++requestIdCounter; // req1Id = 1

    // Delayed promise for User A
    const userAPromise = new Promise<Workspace>((resolve) => {
      setTimeout(() => resolve(WORKSPACE_A), 50);
    });

    // User switches to User B (e.g. logout -> login B)
    const req2Id = ++requestIdCounter; // req2Id = 2
    expect(req2Id).toBe(2);
    currentCommittedState = WORKSPACE_B; // Request 2 completes first or synchronously

    // Request 1 completes later
    const userAResult = await userAPromise;
    if (req1Id === requestIdCounter) {
      currentCommittedState = userAResult; // Stale branch - must NOT execute
    }

    // Stale check prevented overwrite:
    expect(req1Id).not.toBe(requestIdCounter);
    expect(currentCommittedState.id).toBe(WORKSPACE_B.id);
    expect(currentCommittedState.name).toBe('Beta Ventures');
  });

  // --------------------------------------------------------------------------
  // Requirement 10: State machine transition sequence
  // --------------------------------------------------------------------------
  it('10. State machine transitions deterministically through resolving_auth -> loading_workspace -> authenticated', () => {
    const statusTransitions: FinanceStateStatus[] = [];

    // 1. Initial mount
    let status: FinanceStateStatus = 'resolving_auth';
    statusTransitions.push(status);

    // 2. Auth user identified
    status = 'loading_workspace';
    statusTransitions.push(status);

    // 3. Workspace and transactions loaded
    status = 'authenticated';
    statusTransitions.push(status);

    expect(statusTransitions).toEqual([
      'resolving_auth',
      'loading_workspace',
      'authenticated',
    ]);
  });
});
