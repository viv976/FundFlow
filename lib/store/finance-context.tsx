'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Transaction,
  Alert,
  AlertPreferences,
  Workspace,
  UserProfile,
  FinancialKPIs,
  ExpenseBreakdownItem,
  CashFlowProjection,
  CSVImportResult,
  FinancialHealthScore,
  AttentionItem,
  MetricExplanation,
  RiskAlert,
  ScenarioBaselineMetrics,
} from '@/types/finance';
import {
  DEMO_WORKSPACE,
  DEMO_USER,
  DEMO_TRANSACTIONS,
  DEMO_ALERTS,
} from '@/lib/store/demo-data';
import {
  calculateAllKPIs,
  generateCashFlowProjection,
  calculateCategoryBreakdown,
  calculateFinancialHealth,
  evaluateAttentionItems,
  getMetricExplanation,
  evaluateRiskSignals,
  deriveBaselineFromTransactions,
} from '@/lib/finance';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  fetchWorkspaceAndProfile,
  fetchTransactionsFromDb,
  fetchAlertsFromDb,
  insertTransactionDb,
  updateTransactionDb,
  deleteTransactionDb,
  bulkInsertTransactionsDb,
  acknowledgeAlertDb,
  markAllAlertsReadDb,
} from '@/lib/supabase/db';
import { isValidUUID } from '@/lib/validation';
import { signOut } from '@/lib/supabase/auth';

export type FinanceStateStatus =
  | 'resolving_auth'
  | 'demo'
  | 'loading_workspace'
  | 'authenticated'
  | 'no_workspace'
  | 'unauthenticated';

export interface FinanceContextType {
  workspace: Workspace;
  workspaces: Workspace[];
  user: UserProfile;
  transactions: Transaction[];
  alerts: Alert[];
  alertPreferences: AlertPreferences;
  kpis: FinancialKPIs;
  cashFlowProjection: CashFlowProjection;
  expenseBreakdown: ExpenseBreakdownItem[];
  financialHealth: FinancialHealthScore;
  attentionItems: AttentionItem[];
  riskAlerts: RiskAlert[];
  scenarioBaseline: ScenarioBaselineMetrics;
  getMetricDetails: (key: 'cash' | 'burn' | 'runway' | 'growth') => MetricExplanation;
  isLoading: boolean;
  status: FinanceStateStatus;
  isDemo: boolean;
  isWorkspaceReady: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: (targetWorkspaceId?: string, authUserId?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'workspace_id'>) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  importTransactions: (newTransactions: Transaction[]) => Promise<CSVImportResult>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  markAllAlertsRead: () => Promise<void>;
  updateAlertPreferences: (prefs: Partial<AlertPreferences>) => Promise<void>;
  resetToDemoData: () => void;
  exportTransactionsCSV: () => void;
  exportReportJSON: () => string;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export const STORAGE_KEYS = {
  ACTIVE_WORKSPACE_ID: 'fundflow_active_workspace_id_v1',
  LEGACY_WORKSPACE: 'fundflow_workspace_v1',
  DEMO_MODE: 'fundflow_demo_mode_active_v1',
  PREFERENCES: 'fundflow_preferences_v1',
};

/**
 * Tab-scoped demo state helpers.
 * Demo mode is stored in sessionStorage so that:
 * 1. Refreshing the demo tab preserves demo mode in that tab.
 * 2. Other tabs sharing localStorage (real authenticated accounts) are not affected.
 */
export function isDemoModeInSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEYS.DEMO_MODE) === 'true';
  } catch {
    return false;
  }
}

export function setDemoModeInSession(enable: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enable) {
      window.sessionStorage.setItem(STORAGE_KEYS.DEMO_MODE, 'true');
    } else {
      window.sessionStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
    }
    // Clean up any legacy shared localStorage demo flag to prevent cross-tab contamination
    window.localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
  } catch {}
}

/**
 * Tab-scoped active workspace storage read/write helpers.
 * Active workspace is stored in sessionStorage (tab-scoped) so that:
 * 1. Each browser tab independently preserves its selected workspace across refreshes.
 * 2. One tab switching workspace does not overwrite another tab's active workspace.
 * 3. Fallback to localStorage is only used when a new tab opens without a prior tab selection.
 * Keys are user-scoped so workspace selections do not cross user/account boundaries.
 */
function parseWorkspaceIdCandidate(candidate: string | null): string | null {
  if (!candidate) return null;
  try {
    if (candidate.startsWith('{')) {
      const parsed = JSON.parse(candidate);
      if (isValidUUID(parsed?.id) && parsed.id !== DEMO_WORKSPACE.id) {
        return parsed.id;
      }
    } else if (isValidUUID(candidate) && candidate !== DEMO_WORKSPACE.id) {
      return candidate;
    }
  } catch {}
  return null;
}

export function getActiveWorkspaceStorageKey(userId?: string): string {
  return userId ? `${STORAGE_KEYS.ACTIVE_WORKSPACE_ID}_${userId}` : STORAGE_KEYS.ACTIVE_WORKSPACE_ID;
}

export function getActiveWorkspaceId(userId?: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Tab-scoped storage (sessionStorage) has top priority
    if (userId) {
      const userTabCandidate = parseWorkspaceIdCandidate(
        window.sessionStorage.getItem(getActiveWorkspaceStorageKey(userId))
      );
      if (userTabCandidate) return userTabCandidate;
    }

    const genericTabCandidate = parseWorkspaceIdCandidate(
      window.sessionStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID)
    );
    if (genericTabCandidate) return genericTabCandidate;

    // 2. Cross-tab persistent fallback (localStorage) for newly opened tabs or initial loads
    if (userId) {
      const userLocalCandidate = parseWorkspaceIdCandidate(
        window.localStorage.getItem(getActiveWorkspaceStorageKey(userId))
      );
      if (userLocalCandidate) return userLocalCandidate;
    }

    const genericLocalCandidate = parseWorkspaceIdCandidate(
      window.localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID) ||
      window.localStorage.getItem(STORAGE_KEYS.LEGACY_WORKSPACE)
    );
    if (genericLocalCandidate) return genericLocalCandidate;

    return null;
  } catch {
    return null;
  }
}

export function setActiveWorkspaceId(workspaceId: string, userId?: string): void {
  if (typeof window === 'undefined') return;
  if (!isValidUUID(workspaceId) || workspaceId === DEMO_WORKSPACE.id) return;
  try {
    // Tab-scoped: always save in sessionStorage for this tab
    window.sessionStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, workspaceId);
    if (userId) {
      window.sessionStorage.setItem(getActiveWorkspaceStorageKey(userId), workspaceId);
      // Persistent storage: also save user-scoped in localStorage so new tabs for this user open with this workspace
      window.localStorage.setItem(getActiveWorkspaceStorageKey(userId), workspaceId);
    }
    // Also save general key in localStorage for backward compatibility
    window.localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID, workspaceId);
  } catch {}
}

export function clearActiveWorkspaceId(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID);
    if (userId) {
      window.sessionStorage.removeItem(getActiveWorkspaceStorageKey(userId));
    }
  } catch {}
}

// Neutral uninitialized sentinel models ensuring SSR/hydration consistency without leaking demo data
export const INITIAL_RESOLVING_WORKSPACE: Workspace = {
  id: '00000000-0000-0000-0000-000000000000',
  name: '',
  owner_id: '',
  currency: 'USD',
  starting_cash: 0,
  alert_runway_threshold: 6,
  created_at: '',
};

export const INITIAL_RESOLVING_USER: UserProfile = {
  id: '',
  full_name: '',
  email: '',
  role: 'owner',
};

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Deterministic neutral initial states matching between SSR and hydration
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace>(INITIAL_RESOLVING_WORKSPACE);
  const [user, setUser] = useState<UserProfile>(INITIAL_RESOLVING_USER);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertPreferences, setAlertPreferences] = useState<AlertPreferences>({
    workspace_id: '',
    runway_threshold_months: 6.0,
    expense_spike_percentage: 40.0,
    cash_minimum_threshold: 50000.0,
    large_transaction_threshold: 10000.0,
    email_notifications_enabled: true,
    slack_notifications_enabled: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<FinanceStateStatus>('resolving_auth');
  const [isDemo, setIsDemo] = useState<boolean>(false);

  // Request epoch ref and active user tracking to guarantee race condition immunity across user switches
  const requestIdRef = useRef<number>(0);
  const activeUserIdRef = useRef<string | null>(null);
  const activeWorkspaceIdRef = useRef<string | null>(null);
  const inFlightSyncRef = useRef<Promise<void> | null>(null);

  const workspaceRef = useRef<Workspace>(workspace);
  const statusRef = useRef<FinanceStateStatus>(status);

  useEffect(() => {
    workspaceRef.current = workspace;
    statusRef.current = status;
  }, [workspace, status]);

  const isWorkspaceReady =
    (status === 'authenticated' || status === 'demo') &&
    workspace.id !== INITIAL_RESOLVING_WORKSPACE.id &&
    !isLoading;

  // Development-only diagnostic logger
  const debugLog = useCallback((operation: string, details?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString().split('T')[1]?.replace('Z', '') || '';
      console.log(`[FundFlow:Auth ${timestamp}] ${operation}`, details || {});
    }
  }, []);

  // Explicit Demo Mode Activation (scoped strictly to this browser tab via sessionStorage)
  const enterDemoMode = useCallback(() => {
    activeUserIdRef.current = null;
    requestIdRef.current++;
    setDemoModeInSession(true);
    // Note: Do NOT remove STORAGE_KEYS.ACTIVE_WORKSPACE_ID from localStorage!
    // Preserving it ensures Tab A's active workspace is NOT cleared when Tab B launches demo mode.
    setIsDemo(true);
    setStatus('demo');
    setWorkspaces([DEMO_WORKSPACE]);
    setWorkspace(DEMO_WORKSPACE);
    setUser(DEMO_USER);
    setTransactions(DEMO_TRANSACTIONS);
    setAlerts(DEMO_ALERTS);
    setAlertPreferences({
      workspace_id: DEMO_WORKSPACE.id,
      runway_threshold_months: 6.0,
      expense_spike_percentage: 40.0,
      cash_minimum_threshold: 50000.0,
      large_transaction_threshold: 10000.0,
      email_notifications_enabled: true,
      slack_notifications_enabled: false,
    });
    setIsLoading(false);
  }, []);

  // Explicit Demo Mode Exit (clears tab-scoped demo state)
  const exitDemoMode = useCallback(() => {
    activeUserIdRef.current = null;
    requestIdRef.current++;
    setDemoModeInSession(false);
    setIsDemo(false);
    setStatus('unauthenticated');
    setWorkspaces([]);
    setWorkspace(INITIAL_RESOLVING_WORKSPACE);
    setUser(INITIAL_RESOLVING_USER);
    setTransactions([]);
    setAlerts([]);
    setIsLoading(false);
  }, []);

  // Reset to demo data delegates directly to explicit enterDemoMode
  const resetToDemoData = useCallback(() => {
    enterDemoMode();
  }, [enterDemoMode]);

  // Synchronize authenticated session and authorized workspace deterministically
  const syncAuthAndWorkspace = useCallback(
    async (authUserId?: string, targetWorkspaceId?: string, forceRefresh?: boolean) => {
      // If authUserId is explicitly passed (e.g. from an explicit user login in this tab),
      // we must terminate any tab-scoped demo mode.
      if (authUserId) {
        setDemoModeInSession(false);
      }

      // Check if this tab is running in explicit tab-scoped demo mode
      if (isDemoModeInSession() && !authUserId) {
        activeUserIdRef.current = null;
        activeWorkspaceIdRef.current = null;
        setIsDemo(true);
        setStatus('demo');
        setWorkspaces([DEMO_WORKSPACE]);
        setWorkspace(DEMO_WORKSPACE);
        setUser(DEMO_USER);
        setTransactions(DEMO_TRANSACTIONS);
        setAlerts(DEMO_ALERTS);
        setAlertPreferences({
          workspace_id: DEMO_WORKSPACE.id,
          runway_threshold_months: 6.0,
          expense_spike_percentage: 40.0,
          cash_minimum_threshold: 50000.0,
          large_transaction_threshold: 10000.0,
          email_notifications_enabled: true,
          slack_notifications_enabled: false,
        });
        setIsLoading(false);
        debugLog('syncAuthAndWorkspace: isolated demo mode restored for tab');
        return;
      }

      let effectiveUserId = authUserId;

      // If authUserId not explicitly provided, resolve from Supabase session
      if (!effectiveUserId && isSupabaseConfigured) {
        try {
          const { data } = await supabase.auth.getSession();
          effectiveUserId = data.session?.user?.id;
        } catch (sessionErr) {
          console.warn('Session retrieval notice:', sessionErr);
        }
      }

      // Fast-path skip: if state is already verified and ready for this exact user and workspace,
      // never unload, never set isLoading(true), and never duplicate network requests.
      const currentWs = workspaceRef.current;
      const currentStatus = statusRef.current;
      const isAlreadyReady =
        Boolean(effectiveUserId) &&
        activeUserIdRef.current === effectiveUserId &&
        currentWs.id !== INITIAL_RESOLVING_WORKSPACE.id &&
        currentStatus === 'authenticated' &&
        (!targetWorkspaceId || targetWorkspaceId === currentWs.id);

      if (!forceRefresh && isAlreadyReady) {
        debugLog('syncAuthAndWorkspace: skipped, workspace already active & verified', {
          userId: effectiveUserId ? effectiveUserId.substring(0, 8) + '...' : 'none',
          workspaceId: currentWs.id,
        });
        return;
      }

      // Request coalescing: if an identical sync is already in flight for this user, await it
      if (inFlightSyncRef.current) {
        debugLog('syncAuthAndWorkspace: coalescing with existing in-flight request', {
          userId: effectiveUserId ? effectiveUserId.substring(0, 8) + '...' : 'none',
        });
        await inFlightSyncRef.current;
        return;
      }

      const executeSync = async () => {
        const requestId = ++requestIdRef.current;
        await Promise.resolve();
        setIsLoading(true);
        if (!effectiveUserId && !activeUserIdRef.current) {
          setStatus('resolving_auth');
        } else {
          setStatus('loading_workspace');
        }

        try {
          // Branch 1: User is Authenticated
          if (effectiveUserId) {
            setStatus('loading_workspace');
            // Detect user transition: if different from previous active user, purge old data immediately
            if (activeUserIdRef.current && activeUserIdRef.current !== effectiveUserId) {
              setWorkspace(INITIAL_RESOLVING_WORKSPACE);
              setWorkspaces([]);
              setUser(INITIAL_RESOLVING_USER);
              setTransactions([]);
              setAlerts([]);
              activeWorkspaceIdRef.current = null;
            }
            activeUserIdRef.current = effectiveUserId;
            setDemoModeInSession(false);

            const savedWsId = targetWorkspaceId || getActiveWorkspaceId(effectiveUserId) || undefined;

            debugLog('fetchWorkspaceAndProfile: starting', {
              userId: effectiveUserId.substring(0, 8) + '...',
              targetWsId: savedWsId || 'primary',
            });

            // Fetch authorized workspaces and profile from Supabase with explicit effectiveUserId
            const { workspace: dbWs, workspaces: dbAllWs, user: dbUser } = await fetchWorkspaceAndProfile(
              savedWsId,
              effectiveUserId
            );

            // Discard stale async responses if a newer request has started
            if (requestId !== requestIdRef.current) return;

            setIsDemo(false);

            if (dbWs) {
              debugLog('fetchTransactionsAndAlerts: starting concurrently', {
                workspaceId: dbWs.id,
              });

              // Load transactions and alerts concurrently for the authorized workspace
              const [dbTxs, dbAlerts] = await Promise.all([
                fetchTransactionsFromDb(dbWs.id),
                fetchAlertsFromDb(dbWs.id),
              ]);

              // Discard stale async responses if a newer request has started
              if (requestId !== requestIdRef.current) return;

              activeUserIdRef.current = effectiveUserId;
              activeWorkspaceIdRef.current = dbWs.id;

              // Atomically update workspace identity AND financial data in the same render
              setWorkspaces(dbAllWs);
              setWorkspace(dbWs);
              if (dbUser) setUser(dbUser);
              setTransactions(dbTxs || []);
              setAlerts(dbAlerts || []);
              setAlertPreferences((prev) => ({ ...prev, workspace_id: dbWs.id }));
              setStatus('authenticated');

              setActiveWorkspaceId(dbWs.id, effectiveUserId);

              debugLog('syncAuthAndWorkspace: completed successfully', {
                workspaceId: dbWs.id,
                transactionCount: dbTxs?.length || 0,
                alertCount: dbAlerts?.length || 0,
              });
            } else {
              setWorkspaces([]);
              setWorkspace(INITIAL_RESOLVING_WORKSPACE);
              if (dbUser) setUser(dbUser);
              setTransactions([]);
              setAlerts([]);
              setStatus('no_workspace');
            }
          } else {
            // Branch 2: No Authenticated User Session
            activeUserIdRef.current = null;
            activeWorkspaceIdRef.current = null;

            const isDemoExplicit = isDemoModeInSession();

            if (requestId !== requestIdRef.current) return;

            if (isDemoExplicit) {
              // Explicit Demo Mode
              setIsDemo(true);
              setStatus('demo');
              setWorkspaces([DEMO_WORKSPACE]);
              setWorkspace(DEMO_WORKSPACE);
              setUser(DEMO_USER);
              setTransactions(DEMO_TRANSACTIONS);
              setAlerts(DEMO_ALERTS);
              setAlertPreferences({
                workspace_id: DEMO_WORKSPACE.id,
                runway_threshold_months: 6.0,
                expense_spike_percentage: 40.0,
                cash_minimum_threshold: 50000.0,
                large_transaction_threshold: 10000.0,
                email_notifications_enabled: true,
                slack_notifications_enabled: false,
              });
            } else {
              // Unauthenticated visitor
              setIsDemo(false);
              setStatus('unauthenticated');
              setWorkspaces([]);
              setWorkspace(INITIAL_RESOLVING_WORKSPACE);
              setUser(INITIAL_RESOLVING_USER);
              setTransactions([]);
              setAlerts([]);
            }
          }
        } catch (err) {
          console.warn('Auth and workspace synchronization error:', err);
        } finally {
          inFlightSyncRef.current = null;
          if (requestId === requestIdRef.current) {
            setIsLoading(false);
          }
        }
      };

      const syncPromise = executeSync();
      inFlightSyncRef.current = syncPromise;
      await syncPromise;
    },
    [debugLog]
  );

  // Switch to a different workspace with strict state isolation
  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (workspaceId === DEMO_WORKSPACE.id) {
        enterDemoMode();
        return;
      }

      setDemoModeInSession(false);
      const target = workspaces.find((w) => w.id === workspaceId);
      if (target) {
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        // Clear old financial state immediately so there is zero overlap between workspaces
        setTransactions([]);
        setAlerts([]);

        try {
          const [dbTxs, dbAlerts] = await Promise.all([
            fetchTransactionsFromDb(target.id),
            fetchAlertsFromDb(target.id),
          ]);

          if (requestId !== requestIdRef.current) return;

          activeWorkspaceIdRef.current = target.id;
          setWorkspace(target);
          setTransactions(dbTxs || []);
          setAlerts(dbAlerts || []);
          setAlertPreferences((prev) => ({ ...prev, workspace_id: target.id }));

          setActiveWorkspaceId(target.id, activeUserIdRef.current || undefined);
          setDemoModeInSession(false);
        } catch (err) {
          console.warn('Error switching workspace:', err);
        } finally {
          if (requestId === requestIdRef.current) {
            setIsLoading(false);
          }
        }
      }
    },
    [workspaces, enterDemoMode]
  );

  // Refresh all accessible workspaces for active user
  const refreshWorkspaces = useCallback(
    async (targetWorkspaceId?: string, authUserId?: string) => {
      await syncAuthAndWorkspace(authUserId, targetWorkspaceId, true);
    },
    [syncAuthAndWorkspace]
  );

  // Sign out cleanly clearing all session and workspace state
  const signOutUser = useCallback(async () => {
    try {
      const isCurrentlyDemo = isDemo || isDemoModeInSession();
      const currentUserId = activeUserIdRef.current;
      activeUserIdRef.current = null;
      activeWorkspaceIdRef.current = null;
      inFlightSyncRef.current = null;
      requestIdRef.current++;
      setDemoModeInSession(false);
      clearActiveWorkspaceId(currentUserId || undefined);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
        if (!isCurrentlyDemo) {
          if (currentUserId) {
            localStorage.removeItem(getActiveWorkspaceStorageKey(currentUserId));
          }
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID);
          localStorage.removeItem(STORAGE_KEYS.LEGACY_WORKSPACE);
          localStorage.removeItem('fundflow_transactions_v1');
          localStorage.removeItem('fundflow_alerts_v1');
          localStorage.removeItem('fundflow_preferences_v1');
        }
      }
      setIsDemo(false);
      setStatus('unauthenticated');
      setWorkspaces([]);
      setWorkspace(INITIAL_RESOLVING_WORKSPACE);
      setUser(INITIAL_RESOLVING_USER);
      setTransactions([]);
      setAlerts([]);
      setIsLoading(false);

      // Only invoke Supabase auth signOut when ending a real authenticated session.
      // In demo mode, no real Supabase session exists for the simulated user;
      // calling signOut() would terminate the real authenticated session belonging to other tabs (Tab A).
      if (!isCurrentlyDemo) {
        await signOut();
      }
    } catch (err) {
      console.warn('Sign out notice:', err);
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, [isDemo]);

  // Post-hydration initialization on client mount and live Supabase Auth listener
  useEffect(() => {
    let isSubscribed = true;

    if (isSupabaseConfigured) {
      // 1. Authoritative Live Supabase Auth subscription
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isSubscribed) return;

        debugLog(`onAuthStateChange event: ${event}`, {
          userId: session?.user?.id ? session.user.id.substring(0, 8) + '...' : 'none',
        });

        // If this tab is running in explicit isolated demo mode, ignore cross-tab auth events
        // so that auth changes or token refreshes in another tab never hijack the demo sandbox.
        if (isDemoModeInSession()) {
          debugLog(`${event}: ignored, tab is running in isolated demo mode`);
          return;
        }

        if (event === 'SIGNED_OUT') {
          const currentUserId = activeUserIdRef.current;
          activeUserIdRef.current = null;
          activeWorkspaceIdRef.current = null;
          inFlightSyncRef.current = null;
          requestIdRef.current++;
          clearActiveWorkspaceId(currentUserId || undefined);
          if (typeof window !== 'undefined') {
            if (currentUserId) {
              localStorage.removeItem(getActiveWorkspaceStorageKey(currentUserId));
            }
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKSPACE_ID);
            localStorage.removeItem(STORAGE_KEYS.LEGACY_WORKSPACE);
            localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
          }
          setIsDemo(false);
          setStatus('unauthenticated');
          setWorkspaces([]);
          setWorkspace(INITIAL_RESOLVING_WORKSPACE);
          setUser(INITIAL_RESOLVING_USER);
          setTransactions([]);
          setAlerts([]);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refresh is an authentication maintenance event.
          // Never unload, wipe, or re-fetch active workspace data!
          debugLog('TOKEN_REFRESHED: maintaining existing authenticated workspace state');
        } else if (event === 'SIGNED_IN') {
          // If this tab is already active and authenticated with an authorized workspace,
          // ignore cross-tab SIGNED_IN events so that an explicit login in another tab
          // never unexpectedly switches this tab's active account or workspace.
          if (
            statusRef.current === 'authenticated' &&
            activeUserIdRef.current &&
            workspaceRef.current.id !== INITIAL_RESOLVING_WORKSPACE.id
          ) {
            debugLog('SIGNED_IN: ignored, tab is already active with an authenticated workspace', {
              activeUserId: activeUserIdRef.current.substring(0, 8) + '...',
              incomingUserId: session?.user?.id ? session.user.id.substring(0, 8) + '...' : 'none',
            });
            return;
          }
          await syncAuthAndWorkspace(session?.user?.id);
        } else if (event === 'INITIAL_SESSION') {
          const userId = session?.user?.id;
          if (
            userId &&
            activeUserIdRef.current === userId &&
            workspaceRef.current.id !== INITIAL_RESOLVING_WORKSPACE.id &&
            statusRef.current === 'authenticated'
          ) {
            debugLog(`${event}: skipped, workspace already active for user`, {
              userId: userId.substring(0, 8) + '...',
              workspaceId: workspaceRef.current.id,
            });
            return;
          }
          await syncAuthAndWorkspace(userId);
        } else if (event === 'USER_UPDATED') {
          if (session?.user?.id && activeUserIdRef.current === session.user.id) {
            if (session.user.user_metadata?.full_name) {
              setUser((prev) => ({
                ...prev,
                full_name: session.user.user_metadata.full_name || prev.full_name,
              }));
            }
          } else {
            await syncAuthAndWorkspace(session?.user?.id);
          }
        }
      });

      // 2. Initial synchronization fallback in case onAuthStateChange didn't fire immediately
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (isSubscribed) {
          if (isDemoModeInSession()) {
            syncAuthAndWorkspace();
            return;
          }
          const userId = session?.user?.id;
          if (
            userId &&
            activeUserIdRef.current === userId &&
            workspaceRef.current.id !== INITIAL_RESOLVING_WORKSPACE.id &&
            statusRef.current === 'authenticated'
          ) {
            return;
          }
          syncAuthAndWorkspace(userId);
        }
      });

      return () => {
        isSubscribed = false;
        subscription.unsubscribe();
      };
    } else {
      Promise.resolve().then(() => {
        if (isSubscribed) {
          syncAuthAndWorkspace();
        }
      });

      return () => {
        isSubscribed = false;
      };
    }
  }, [syncAuthAndWorkspace, debugLog]);

  // Dynamic calculations grounded strictly in current active workspace and its transactions
  const kpis = useMemo(
    () => calculateAllKPIs(transactions, workspace.starting_cash),
    [transactions, workspace.starting_cash]
  );
  const cashFlowProjection = useMemo(
    () => generateCashFlowProjection(transactions, workspace.starting_cash, 6, workspace.currency || 'USD'),
    [transactions, workspace.starting_cash, workspace.currency]
  );
  const expenseBreakdown = useMemo(
    () => calculateCategoryBreakdown(transactions),
    [transactions]
  );
  const financialHealth = useMemo(
    () => calculateFinancialHealth(transactions, workspace.starting_cash, workspace.currency || 'USD'),
    [transactions, workspace.starting_cash, workspace.currency]
  );
  const attentionItems = useMemo(
    () => evaluateAttentionItems(transactions, workspace),
    [transactions, workspace]
  );
  const riskAlerts = useMemo(
    () => evaluateRiskSignals(transactions, workspace),
    [transactions, workspace]
  );
  const scenarioBaseline = useMemo(
    () => deriveBaselineFromTransactions(transactions, workspace),
    [transactions, workspace]
  );
  const getMetricDetails = useCallback(
    (key: 'cash' | 'burn' | 'runway' | 'growth') =>
      getMetricExplanation(key, transactions, workspace),
    [transactions, workspace]
  );

  // Evaluate risk alerts automatically when transactions change
  useEffect(() => {
    if (isLoading || workspace.id === INITIAL_RESOLVING_WORKSPACE.id) return;

    // Check runway threshold
    if (kpis.runwayMonths < alertPreferences.runway_threshold_months && !kpis.isCashFlowPositive) {
      const existingRunwayAlert = alerts.find(
        (a) => a.alert_type === 'runway_risk' && a.status === 'active'
      );
      if (!existingRunwayAlert) {
        const alertId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });

        const generatedAlert: Alert = {
          id: alertId,
          workspace_id: workspace.id,
          alert_type: 'runway_risk',
          severity: kpis.runwayMonths < 3 ? 'critical' : 'warning',
          title: `Low Runway Warning: ${kpis.runwayMonths.toFixed(1)} Months Remaining`,
          message: `Current operational runway of ${kpis.runwayMonths.toFixed(1)} months is below your configured threshold of ${alertPreferences.runway_threshold_months} months.`,
          threshold: alertPreferences.runway_threshold_months,
          current_value: kpis.runwayMonths,
          status: 'active',
          created_at: new Date().toISOString(),
        };
        queueMicrotask(() => {
          setAlerts((prev) => [generatedAlert, ...prev]);
        });
      }
    }
  }, [kpis, alertPreferences, workspace, isLoading, alerts]);

  // Add transaction
  const addTransaction = useCallback(
    async (tx: Omit<Transaction, 'id' | 'workspace_id'>) => {
      if (workspace.id === INITIAL_RESOLVING_WORKSPACE.id) return;
      const txData = {
        ...tx,
        workspace_id: workspace.id,
      };

      if (isSupabaseConfigured && !isDemo) {
        try {
          const inserted = await insertTransactionDb(txData, workspace.id);
          if (inserted) {
            setTransactions((prev) => [inserted, ...prev]);
            return;
          }
        } catch (err) {
          console.warn('DB transaction insert error, updating local state:', err);
        }
      }

      // Offline / demo fallback
      const localTx: Transaction = {
        ...txData,
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `tx-${Date.now()}`,
        status: 'completed',
        source: tx.source || 'manual',
        created_at: new Date().toISOString(),
      };
      setTransactions((prev) => [localTx, ...prev]);
    },
    [workspace, isDemo]
  );

  // Update transaction
  const updateTransaction = useCallback(
    async (id: string, updates: Partial<Transaction>) => {
      if (workspace.id === INITIAL_RESOLVING_WORKSPACE.id) return;
      if (isSupabaseConfigured && !isDemo) {
        try {
          await updateTransactionDb(id, updates, workspace.id);
        } catch (err) {
          console.warn('DB transaction update error:', err);
        }
      }

      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t))
      );
    },
    [workspace, isDemo]
  );

  // Delete transaction
  const deleteTransaction = useCallback(
    async (id: string) => {
      if (workspace.id === INITIAL_RESOLVING_WORKSPACE.id) return;
      if (isSupabaseConfigured && !isDemo) {
        try {
          await deleteTransactionDb(id, workspace.id);
        } catch (err) {
          console.warn('DB transaction delete error:', err);
        }
      }

      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
    [workspace, isDemo]
  );

  // Import transactions from CSV
  const importTransactions = useCallback(
    async (newTransactions: Transaction[]): Promise<CSVImportResult> => {
      if (workspace.id === INITIAL_RESOLVING_WORKSPACE.id) {
        return {
          totalRows: 0,
          importedRows: 0,
          failedRows: 1,
          errors: [{ row: 0, reason: 'No active workspace selected' }],
          transactions: [],
        };
      }

      if (isSupabaseConfigured && !isDemo) {
        try {
          const success = await bulkInsertTransactionsDb(newTransactions, workspace.id);
          if (success) {
            const dbTxs = await fetchTransactionsFromDb(workspace.id);
            if (dbTxs && dbTxs.length > 0) {
              setTransactions(dbTxs);
            }
          }
        } catch (err) {
          console.warn('DB bulk insert error, falling back to state update:', err);
          setTransactions((prev) => [...newTransactions, ...prev]);
        }
      } else {
        setTransactions((prev) => [...newTransactions, ...prev]);
      }

      return {
        totalRows: newTransactions.length,
        importedRows: newTransactions.length,
        failedRows: 0,
        errors: [],
        transactions: newTransactions,
      };
    },
    [workspace, isDemo]
  );

  // Acknowledge alert
  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      if (workspace.id === INITIAL_RESOLVING_WORKSPACE.id) return;
      if (isSupabaseConfigured && !isDemo) {
        try {
          await acknowledgeAlertDb(alertId, workspace.id);
        } catch (err) {
          console.warn('DB alert acknowledge error:', err);
        }
      }

      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: 'acknowledged' } : a))
      );
    },
    [workspace, isDemo]
  );

  // Mark all alerts read
  const markAllAlertsRead = useCallback(async () => {
    if (workspace.id === INITIAL_RESOLVING_WORKSPACE.id) return;
    if (isSupabaseConfigured && !isDemo) {
      try {
        await markAllAlertsReadDb(workspace.id);
      } catch (err) {
        console.warn('DB mark all alerts read error:', err);
      }
    }

    setAlerts((prev) =>
      prev.map((a) => (a.status === 'active' ? { ...a, status: 'acknowledged' } : a))
    );
  }, [workspace, isDemo]);

  // Update alert preferences
  const updateAlertPreferences = useCallback(
    async (prefs: Partial<AlertPreferences>) => {
      const updated = { ...alertPreferences, ...prefs };
      setAlertPreferences(updated);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
        }
      } catch (e) {
        console.error('Failed to persist preferences:', e);
      }
    },
    [alertPreferences]
  );

  // Export transactions CSV
  const exportTransactionsCSV = useCallback(() => {
    if (workspace.id === INITIAL_RESOLVING_WORKSPACE.id) return;
    const headers = ['Date', 'Description', 'Merchant', 'Category', 'Amount', 'Currency', 'Type', 'Status', 'Reference'];
    const rows = transactions.map((t) => [
      t.transaction_date,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.merchant || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.transaction_type === 'expense' ? `-${t.amount}` : t.amount,
      t.currency,
      t.transaction_type,
      t.status,
      `"${(t.external_reference || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fundflow_transactions_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [transactions, workspace]);

  // Export report JSON
  const exportReportJSON = useCallback(() => {
    const report = {
      workspace: workspace.name,
      currency: workspace.currency || 'USD',
      generated_at: new Date().toISOString(),
      kpis,
      expense_breakdown: expenseBreakdown,
      cash_flow_projection: cashFlowProjection,
      active_alerts: alerts.filter((a) => a.status === 'active'),
      transactions_summary: {
        total_count: transactions.length,
        total_inflow: transactions
          .filter((t) => t.transaction_type === 'income')
          .reduce((sum, t) => sum + t.amount, 0),
        total_outflow: transactions
          .filter((t) => t.transaction_type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0),
      },
    };
    return JSON.stringify(report, null, 2);
  }, [workspace.name, workspace.currency, kpis, expenseBreakdown, cashFlowProjection, alerts, transactions]);

  const value: FinanceContextType = {
    workspace,
    workspaces,
    user,
    transactions,
    alerts,
    alertPreferences,
    kpis,
    cashFlowProjection,
    expenseBreakdown,
    financialHealth,
    attentionItems,
    riskAlerts,
    scenarioBaseline,
    getMetricDetails,
    isLoading,
    status,
    isDemo,
    isWorkspaceReady,
    enterDemoMode,
    exitDemoMode,
    switchWorkspace,
    refreshWorkspaces,
    signOutUser,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
    acknowledgeAlert,
    markAllAlertsRead,
    updateAlertPreferences,
    resetToDemoData,
    exportTransactionsCSV,
    exportReportJSON,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export function useFinance(): FinanceContextType {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
