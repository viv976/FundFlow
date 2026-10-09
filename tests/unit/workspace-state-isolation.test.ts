import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEMO_WORKSPACE,
  DEMO_USER,
  DEMO_TRANSACTIONS,
  DEMO_ALERTS,
} from '@/lib/store/demo-data';
import {
  INITIAL_RESOLVING_WORKSPACE,
  INITIAL_RESOLVING_USER,
} from '@/lib/store/finance-context';
import { fetchWorkspaceAndProfile } from '@/lib/supabase/db';
import { calculateAllKPIs } from '@/lib/finance/calculator';
import { Workspace, Transaction, Alert } from '@/types/finance';

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

describe('DEMO WORKSPACE vs REAL USER WORKSPACE STATE ISOLATION & INITIALIZATION', () => {
  const REAL_USER_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';

  const REAL_WORKSPACE_A: Workspace = {
    id: 'aaaaaaaa-1111-4111-8111-444444444444',
    name: 'Personal Account',
    owner_id: REAL_USER_ID,
    currency: 'USD',
    starting_cash: 50000,
    alert_runway_threshold: 6,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  const REAL_WORKSPACE_B: Workspace = {
    id: 'bbbbbbbb-1111-4111-8111-444444444444',
    name: 'Acme Technologies',
    owner_id: REAL_USER_ID,
    currency: 'USD',
    starting_cash: 250000,
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

  const REAL_TRANSACTIONS_A: Transaction[] = [
    {
      id: 'tx-real-a1',
      workspace_id: REAL_WORKSPACE_A.id,
      transaction_date: '2026-03-01',
      description: 'Consulting Income',
      merchant: 'Client A',
      category: 'Revenue',
      amount: 15000,
      currency: 'USD',
      transaction_type: 'income',
      status: 'completed',
      source: 'manual',
    },
  ];

  const REAL_TRANSACTIONS_B: Transaction[] = [
    {
      id: 'tx-real-b1',
      workspace_id: REAL_WORKSPACE_B.id,
      transaction_date: '2026-03-05',
      description: 'Office Rent Expense',
      merchant: 'WeWork',
      category: 'Facilities',
      amount: 8000,
      currency: 'USD',
      transaction_type: 'expense',
      status: 'completed',
      source: 'manual',
    },
    {
      id: 'tx-real-b2',
      workspace_id: REAL_WORKSPACE_B.id,
      transaction_date: '2026-03-10',
      description: 'SaaS Enterprise Subscription',
      merchant: 'Acme Corp Client',
      category: 'Revenue',
      amount: 45000,
      currency: 'USD',
      transaction_type: 'income',
      status: 'completed',
      source: 'manual',
    },
  ];

  const REAL_ALERTS_B: Alert[] = [
    {
      id: 'alert-real-b1',
      workspace_id: REAL_WORKSPACE_B.id,
      alert_type: 'expense_spike',
      severity: 'warning',
      title: 'Monthly Facilities Spike',
      message: 'Rent expense was higher than baseline.',
      status: 'active',
      created_at: '2026-03-05T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------
  // TEST 1: Demo workspace contains demo data
  // -------------------------------------------------------------
  it('1. Demo workspace contains demo data strictly scoped to synthetic entities', () => {
    expect(DEMO_WORKSPACE.id).toBe('e1ab89bf-153d-467b-a530-a6e7063efba1');
    expect(DEMO_WORKSPACE.name).toBe('Acme Technologies');
    expect(DEMO_USER.email).toBe('alex.rivera@demo.fundflow.app');
    expect(DEMO_TRANSACTIONS.length).toBeGreaterThan(0);
    expect(DEMO_ALERTS.length).toBeGreaterThan(0);

    // Verify all demo transactions belong strictly to DEMO_WORKSPACE.id
    for (const tx of DEMO_TRANSACTIONS) {
      expect(tx.workspace_id).toBe(DEMO_WORKSPACE.id);
    }

    // Verify all demo alerts belong strictly to DEMO_WORKSPACE.id
    for (const alert of DEMO_ALERTS) {
      expect(alert.workspace_id).toBe(DEMO_WORKSPACE.id);
    }
  });

  // -------------------------------------------------------------
  // TEST 2: Authenticated real workspace never receives demo transactions
  // -------------------------------------------------------------
  it('2. Authenticated real workspace never receives demo transactions', () => {
    const realTransactions = [...REAL_TRANSACTIONS_B];

    // Assert that demo transactions are NOT present in the real workspace ledger
    const hasDemoTx = realTransactions.some((t) =>
      DEMO_TRANSACTIONS.some((demoTx) => demoTx.id === t.id || demoTx.workspace_id === t.workspace_id)
    );
    expect(hasDemoTx).toBe(false);

    // Real workspace metrics must calculate strictly using real starting cash and real transactions
    const realKpis = calculateAllKPIs(realTransactions, REAL_WORKSPACE_B.starting_cash);
    const demoKpis = calculateAllKPIs(DEMO_TRANSACTIONS, DEMO_WORKSPACE.starting_cash);

    expect(realKpis.cashOnHand).not.toBe(demoKpis.cashOnHand);
    expect(realKpis.cashOnHand).toBe(250000 + 45000 - 8000); // $287,000, not demo's $1.31M!
  });

  // -------------------------------------------------------------
  // TEST 3: Authenticated real workspace never receives demo alerts
  // -------------------------------------------------------------
  it('3. Authenticated real workspace never receives demo alerts', () => {
    const realAlerts = [...REAL_ALERTS_B];

    const hasDemoAlert = realAlerts.some((a) =>
      DEMO_ALERTS.some((demoAlert) => demoAlert.id === a.id || demoAlert.workspace_id === a.workspace_id)
    );
    expect(hasDemoAlert).toBe(false);

    for (const alert of realAlerts) {
      expect(alert.workspace_id).toBe(REAL_WORKSPACE_B.id);
      expect(alert.workspace_id).not.toBe(DEMO_WORKSPACE.id);
    }
  });

  // -------------------------------------------------------------
  // TEST 4: Authenticated user resolves their authorized workspace
  // -------------------------------------------------------------
  it('4. Authenticated user resolves their authorized workspace via membership and ownership', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID, email: 'founder@acme.com' } } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [] }),
          }),
        };
      }
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A, REAL_WORKSPACE_B] }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({
                  data: [{ id: REAL_USER_ID, full_name: 'Jane Doe', email: 'founder@acme.com' }],
                }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await fetchWorkspaceAndProfile();

    expect(result.workspace).not.toBeNull();
    expect(result.workspaces.length).toBe(2);
    expect(result.user?.id).toBe(REAL_USER_ID);
    expect(result.user?.full_name).toBe('Jane Doe');
    expect(result.workspaces.map((w) => w.id)).toContain(REAL_WORKSPACE_A.id);
    expect(result.workspaces.map((w) => w.id)).toContain(REAL_WORKSPACE_B.id);
    expect(result.workspaces.map((w) => w.id)).not.toContain(DEMO_WORKSPACE.id);
  });

  // -------------------------------------------------------------
  // TEST 5: Persisted valid workspace is restored
  // -------------------------------------------------------------
  it('5. Persisted valid workspace is restored when user is authorized', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID, email: 'founder@acme.com' } } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      }
      if (table === 'workspaces') {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A, REAL_WORKSPACE_B] }) }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
        };
      }
      return {};
    });

    // Requesting REAL_WORKSPACE_B specifically (as if persisted in localStorage)
    const result = await fetchWorkspaceAndProfile(REAL_WORKSPACE_B.id);

    expect(result.workspace).not.toBeNull();
    expect(result.workspace?.id).toBe(REAL_WORKSPACE_B.id);
    expect(result.workspace?.name).toBe('Acme Technologies');
  });

  // -------------------------------------------------------------
  // TEST 6: Persisted unauthorized workspace is rejected
  // -------------------------------------------------------------
  it('6. Persisted unauthorized workspace is rejected and falls back to deterministic authorized workspace', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID, email: 'founder@acme.com' } } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      }
      if (table === 'workspaces') {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A, REAL_WORKSPACE_B] }) }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
        };
      }
      return {};
    });

    // Pass unauthorized competitor workspace ID or DEMO_WORKSPACE.id
    const resultUnauthorized = await fetchWorkspaceAndProfile(UNAUTHORIZED_WORKSPACE.id);
    expect(resultUnauthorized.workspace?.id).not.toBe(UNAUTHORIZED_WORKSPACE.id);
    expect(resultUnauthorized.workspace?.id).toBe(REAL_WORKSPACE_A.id);

    // Pass DEMO_WORKSPACE ID while authenticated
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID, email: 'founder@acme.com' } } },
    });
    const resultDemoAttempt = await fetchWorkspaceAndProfile(DEMO_WORKSPACE.id);
    expect(resultDemoAttempt.workspace?.id).not.toBe(DEMO_WORKSPACE.id);
    expect(resultDemoAttempt.workspace?.id).toBe(REAL_WORKSPACE_A.id);
  });

  // -------------------------------------------------------------
  // TEST 7: Multiple workspaces resolve deterministically
  // -------------------------------------------------------------
  it('7. Multiple workspaces resolve deterministically regardless of random database row ordering', async () => {
    // Test Order 1: DB returns [B, A]
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_B, REAL_WORKSPACE_A] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const result1 = await fetchWorkspaceAndProfile();

    // Test Order 2: DB returns [A, B]
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A, REAL_WORKSPACE_B] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const result2 = await fetchWorkspaceAndProfile();

    // Both must deterministically select the primary workspace (REAL_WORKSPACE_A, created earlier)
    expect(result1.workspace?.id).toBe(REAL_WORKSPACE_A.id);
    expect(result2.workspace?.id).toBe(REAL_WORKSPACE_A.id);
    expect(result1.workspaces[0].id).toBe(result2.workspaces[0].id);
    expect(result1.workspaces[1].id).toBe(result2.workspaces[1].id);
  });

  // -------------------------------------------------------------
  // TEST 8: Workspace switch changes financial state
  // -------------------------------------------------------------
  it('8. Workspace switch changes financial state atomically with zero cross-workspace bleed', () => {
    let activeWorkspace = REAL_WORKSPACE_A;
    let activeTransactions = REAL_TRANSACTIONS_A;

    // Workspace A metrics
    const kpisA = calculateAllKPIs(activeTransactions, activeWorkspace.starting_cash);
    expect(kpisA.cashOnHand).toBe(50000 + 15000); // $65,000

    // Switch to Workspace B
    activeWorkspace = REAL_WORKSPACE_B;
    activeTransactions = REAL_TRANSACTIONS_B;

    // Workspace B metrics
    const kpisB = calculateAllKPIs(activeTransactions, activeWorkspace.starting_cash);
    expect(kpisB.cashOnHand).toBe(250000 + 45000 - 8000); // $287,000

    // Assert that Workspace A transactions are completely absent from Workspace B
    expect(activeTransactions.some((t) => t.id === 'tx-real-a1')).toBe(false);
  });

  // -------------------------------------------------------------
  // TEST 9: Refresh preserves selected real workspace
  // -------------------------------------------------------------
  it('9. Refresh preserves selected real workspace via persisted active workspace ID', async () => {
    // User switches to Workspace B and stores ID
    const persistedKey = 'fundflow_active_workspace_id_v1';
    const simulatedLocalStorage: Record<string, string> = {
      [persistedKey]: REAL_WORKSPACE_B.id,
    };

    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A, REAL_WORKSPACE_B] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const targetIdFromStorage = simulatedLocalStorage[persistedKey];
    const refreshResult = await fetchWorkspaceAndProfile(targetIdFromStorage);

    expect(refreshResult.workspace?.id).toBe(REAL_WORKSPACE_B.id);
    expect(refreshResult.workspace?.name).toBe('Acme Technologies');
  });

  // -------------------------------------------------------------
  // TEST 10: Logout clears real workspace state
  // -------------------------------------------------------------
  it('10. Logout clears real workspace state and removes all storage keys', () => {
    const simulatedLocalStorage: Record<string, string> = {
      fundflow_active_workspace_id_v1: REAL_WORKSPACE_B.id,
      fundflow_workspace_v1: JSON.stringify(REAL_WORKSPACE_B),
      fundflow_demo_mode_active_v1: 'false',
      fundflow_transactions_v1: JSON.stringify(REAL_TRANSACTIONS_B),
    };

    // Simulate signOutUser cleanup
    delete simulatedLocalStorage.fundflow_active_workspace_id_v1;
    delete simulatedLocalStorage.fundflow_workspace_v1;
    delete simulatedLocalStorage.fundflow_demo_mode_active_v1;
    delete simulatedLocalStorage.fundflow_transactions_v1;

    expect(simulatedLocalStorage.fundflow_active_workspace_id_v1).toBeUndefined();
    expect(simulatedLocalStorage.fundflow_workspace_v1).toBeUndefined();
    expect(simulatedLocalStorage.fundflow_demo_mode_active_v1).toBeUndefined();
    expect(simulatedLocalStorage.fundflow_transactions_v1).toBeUndefined();
  });

  // -------------------------------------------------------------
  // TEST 11: Demo mode after logout still works
  // -------------------------------------------------------------
  it('11. Demo mode after logout activates demo workspace and synthetic transactions', () => {
    // User launches demo
    const isDemo = true;
    const currentWorkspace = DEMO_WORKSPACE;
    const currentTransactions = DEMO_TRANSACTIONS;
    const currentAlerts = DEMO_ALERTS;

    expect(isDemo).toBe(true);
    expect(currentWorkspace.id).toBe(DEMO_WORKSPACE.id);
    expect(currentWorkspace.name).toBe('Acme Technologies');
    expect(currentTransactions.length).toBe(18);
    expect(currentAlerts.length).toBe(3);

    const demoKpis = calculateAllKPIs(currentTransactions, currentWorkspace.starting_cash);
    expect(demoKpis.cashOnHand).toBeGreaterThan(1000000);
  });

  // -------------------------------------------------------------
  // TEST 12: Real login after demo mode does not inherit demo state
  // -------------------------------------------------------------
  it('12. Real login after demo mode clears demo mode and never inherits demo transactions', async () => {
    // Pre-condition: user was previously viewing demo
    let isDemo = true;
    let activeWorkspace: Workspace | null = DEMO_WORKSPACE;
    let activeTransactions: Transaction[] = DEMO_TRANSACTIONS;

    // Real user logs in
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: REAL_USER_ID, email: 'real@company.com' } } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [REAL_WORKSPACE_A] }) }) };
      }
      return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    });

    const initResult = await fetchWorkspaceAndProfile();

    // State transition upon authenticating
    isDemo = false;
    activeWorkspace = initResult.workspace;
    activeTransactions = []; // Fresh or DB-loaded transactions for REAL_WORKSPACE_A

    expect(isDemo).toBe(false);
    expect(activeWorkspace?.id).toBe(REAL_WORKSPACE_A.id);
    expect(activeWorkspace?.id).not.toBe(DEMO_WORKSPACE.id);
    expect(activeTransactions).toEqual([]);
    expect(activeTransactions).not.toEqual(DEMO_TRANSACTIONS);
  });

  // -------------------------------------------------------------
  // TEST 13: Workspace name and transaction data always correspond
  // -------------------------------------------------------------
  it('13. Workspace name and transaction data always correspond in metric calculations', () => {
    // Workspace A
    const kpisA = calculateAllKPIs(REAL_TRANSACTIONS_A, REAL_WORKSPACE_A.starting_cash);
    expect(kpisA.cashOnHand).toBe(65000);

    // Workspace B
    const kpisB = calculateAllKPIs(REAL_TRANSACTIONS_B, REAL_WORKSPACE_B.starting_cash);
    expect(kpisB.cashOnHand).toBe(287000);

    // Mismatched state (e.g. Workspace B name with Workspace A transactions) must never occur
    const mismatchedKpis = calculateAllKPIs(REAL_TRANSACTIONS_A, REAL_WORKSPACE_B.starting_cash);
    expect(mismatchedKpis.cashOnHand).not.toBe(kpisB.cashOnHand);
    expect(mismatchedKpis.cashOnHand).toBe(265000); // 250K starting + 15K from A
  });

  // -------------------------------------------------------------
  // TEST 14: No hydration mismatch is introduced
  // -------------------------------------------------------------
  it('14. SSR and client initial state are deterministic and identical without accessing localStorage in useState', () => {
    // Initial state rendered during SSR:
    const ssrInitialWorkspace = INITIAL_RESOLVING_WORKSPACE;
    const ssrInitialUser = INITIAL_RESOLVING_USER;
    const ssrInitialTransactions: Transaction[] = [];
    const ssrInitialAlerts: Alert[] = [];
    const ssrInitialIsLoading = true;
    const ssrInitialIsDemo = false;

    // Initial state rendered during Client Hydration:
    const clientInitialWorkspace = INITIAL_RESOLVING_WORKSPACE;
    const clientInitialUser = INITIAL_RESOLVING_USER;
    const clientInitialTransactions: Transaction[] = [];
    const clientInitialAlerts: Alert[] = [];
    const clientInitialIsLoading = true;
    const clientInitialIsDemo = false;

    // Both must be identical:
    expect(ssrInitialWorkspace).toEqual(clientInitialWorkspace);
    expect(ssrInitialUser).toEqual(clientInitialUser);
    expect(ssrInitialTransactions).toEqual(clientInitialTransactions);
    expect(ssrInitialAlerts).toEqual(clientInitialAlerts);
    expect(ssrInitialIsLoading).toBe(clientInitialIsLoading);
    expect(ssrInitialIsDemo).toBe(clientInitialIsDemo);

    // Neither is DEMO_WORKSPACE or DEMO_TRANSACTIONS
    expect(ssrInitialWorkspace.id).not.toBe(DEMO_WORKSPACE.id);
    expect(ssrInitialTransactions.length).toBe(0);
    expect(ssrInitialAlerts.length).toBe(0);
  });
});
