'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@/lib/finance/calculator';
import { isSupabaseConfigured } from '@/lib/supabase/client';
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

import { signOut } from '@/lib/supabase/auth';

interface FinanceContextType {
  workspace: Workspace;
  workspaces: Workspace[];
  user: UserProfile;
  transactions: Transaction[];
  alerts: Alert[];
  alertPreferences: AlertPreferences;
  kpis: FinancialKPIs;
  cashFlowProjection: CashFlowProjection;
  expenseBreakdown: ExpenseBreakdownItem[];
  isLoading: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: (targetWorkspaceId?: string) => Promise<void>;
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

const STORAGE_KEYS = {
  TRANSACTIONS: 'fundflow_transactions_v1',
  ALERTS: 'fundflow_alerts_v1',
  PREFERENCES: 'fundflow_preferences_v1',
  WORKSPACE: 'fundflow_workspace_v1',
};

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([DEMO_WORKSPACE]);
  const [workspace, setWorkspace] = useState<Workspace>(DEMO_WORKSPACE);
  const [user, setUser] = useState<UserProfile>(DEMO_USER);
  const [transactions, setTransactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [alerts, setAlerts] = useState<Alert[]>(DEMO_ALERTS);
  const [alertPreferences, setAlertPreferences] = useState<AlertPreferences>({
    workspace_id: DEMO_WORKSPACE.id,
    runway_threshold_months: 6.0,
    expense_spike_percentage: 40.0,
    cash_minimum_threshold: 50000.0,
    large_transaction_threshold: 10000.0,
    email_notifications_enabled: true,
    slack_notifications_enabled: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load active workspace data from Supabase
  const loadWorkspaceData = useCallback(async (targetWorkspace: Workspace) => {
    try {
      setIsLoading(true);
      const [dbTxs, dbAlerts] = await Promise.all([
        fetchTransactionsFromDb(targetWorkspace.id),
        fetchAlertsFromDb(targetWorkspace.id),
      ]);

      if (dbTxs && dbTxs.length > 0) {
        setTransactions(dbTxs);
      } else {
        // If brand new workspace with 0 transactions, set empty array
        setTransactions([]);
      }

      if (dbAlerts && dbAlerts.length > 0) {
        setAlerts(dbAlerts);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.warn('Error loading workspace data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Switch to a different workspace
  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      const found = workspaces.find((w) => w.id === workspaceId);
      if (found) {
        setWorkspace(found);
        setAlertPreferences((prev) => ({ ...prev, workspace_id: found.id }));
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.WORKSPACE, JSON.stringify(found));
        }
        await loadWorkspaceData(found);
      }
    },
    [workspaces, loadWorkspaceData]
  );

  // Refresh all accessible workspaces
  const refreshWorkspaces = useCallback(
    async (targetWorkspaceId?: string) => {
      try {
        const { workspace: dbWs, workspaces: dbAllWs, user: dbUser } = await fetchWorkspaceAndProfile(
          targetWorkspaceId
        );

        if (dbAllWs && dbAllWs.length > 0) {
          setWorkspaces(dbAllWs);
        }
        if (dbWs) {
          setWorkspace(dbWs);
          setAlertPreferences((prev) => ({ ...prev, workspace_id: dbWs.id }));
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.WORKSPACE, JSON.stringify(dbWs));
          }
          await loadWorkspaceData(dbWs);
        }
        if (dbUser) {
          setUser(dbUser);
        }
      } catch (err) {
        console.warn('Error refreshing workspaces:', err);
      }
    },
    [loadWorkspaceData]
  );

  // Sign out
  const signOutUser = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out notice:', err);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.WORKSPACE);
        window.location.href = '/login';
      }
    }
  }, []);

  // Initialize data on mount
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        if (isSupabaseConfigured) {
          let savedWsId: string | undefined;
          if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEYS.WORKSPACE);
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                if (
                  parsed?.id &&
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)
                ) {
                  savedWsId = parsed.id;
                } else {
                  localStorage.removeItem(STORAGE_KEYS.WORKSPACE);
                }
              } catch {}
            }
          }

          const { workspace: dbWs, workspaces: dbAllWs, user: dbUser } = await fetchWorkspaceAndProfile(savedWsId);
          if (isMounted) {
            if (dbAllWs && dbAllWs.length > 0) {
              setWorkspaces(dbAllWs);
            }
            if (dbWs) {
              setWorkspace(dbWs);
              setAlertPreferences((prev) => ({ ...prev, workspace_id: dbWs.id }));
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.WORKSPACE, JSON.stringify(dbWs));
              }
              const [dbTxs, dbAlerts] = await Promise.all([
                fetchTransactionsFromDb(dbWs.id),
                fetchAlertsFromDb(dbWs.id),
              ]);
              if (isMounted) {
                if (dbTxs && dbTxs.length > 0) {
                  setTransactions(dbTxs);
                }
                if (dbAlerts && dbAlerts.length > 0) {
                  setAlerts(dbAlerts);
                }
              }
            }
            if (dbUser) {
              setUser(dbUser);
            }
          }
        }
      } catch (e) {
        console.warn('Data initialization error, using local state:', e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save changes to LocalStorage
  const persistTransactions = useCallback((txList: Transaction[]) => {
    setTransactions(txList);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txList));
      }
    } catch (e) {
      console.error('Failed to persist transactions:', e);
    }
  }, []);

  const persistAlerts = useCallback((alertList: Alert[]) => {
    setAlerts(alertList);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alertList));
      }
    } catch (e) {
      console.error('Failed to persist alerts:', e);
    }
  }, []);

  // Dynamic calculations
  const kpis = useMemo(
    () => calculateAllKPIs(transactions, workspace.starting_cash),
    [transactions, workspace.starting_cash]
  );
  const cashFlowProjection = useMemo(
    () => generateCashFlowProjection(kpis.cashOnHand, kpis.monthlyBurn),
    [kpis.cashOnHand, kpis.monthlyBurn]
  );
  const expenseBreakdown = useMemo(
    () => calculateCategoryBreakdown(transactions),
    [transactions]
  );

  // Evaluate risk alerts automatically when transactions change
  useEffect(() => {
    if (isLoading) return;

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
          severity: 'critical',
          title: `Runway below ${alertPreferences.runway_threshold_months} months`,
          message: `Current runway is ${kpis.runwayMonths.toFixed(1)} months. Immediate burn reduction recommended.`,
          threshold: alertPreferences.runway_threshold_months,
          current_value: kpis.runwayMonths,
          status: 'active',
          created_at: new Date().toISOString(),
        };
        // Schedule update asynchronously to avoid render cycle warnings
        const timer = setTimeout(() => {
          persistAlerts([generatedAlert, ...alerts]);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [kpis, alertPreferences, workspace.id, isLoading, alerts, persistAlerts]);

  // Transaction CRUD Operations
  const addTransaction = useCallback(
    async (txData: Omit<Transaction, 'id' | 'workspace_id'>) => {
      const tempId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newTx: Transaction = {
        ...txData,
        id: tempId,
        workspace_id: workspace.id,
        created_at: new Date().toISOString(),
      };

      const updated = [newTx, ...transactions];
      persistTransactions(updated);

      if (isSupabaseConfigured) {
        try {
          const inserted = await insertTransactionDb(txData, workspace.id);
          if (inserted) {
            const finalUpdated = updated.map((t) => (t.id === tempId ? inserted : t));
            persistTransactions(finalUpdated);
          }
        } catch (err) {
          console.warn('Supabase insert warning:', err);
        }
      }
    },
    [workspace.id, transactions, persistTransactions]
  );

  const updateTransaction = useCallback(
    async (id: string, updates: Partial<Transaction>) => {
      const updated = transactions.map((t) =>
        t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
      );
      persistTransactions(updated);

      if (isSupabaseConfigured) {
        try {
          await updateTransactionDb(id, updates, workspace.id);
        } catch (err) {
          console.warn('Supabase update warning:', err);
        }
      }
    },
    [workspace.id, transactions, persistTransactions]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const updated = transactions.filter((t) => t.id !== id);
      persistTransactions(updated);

      if (isSupabaseConfigured) {
        try {
          await deleteTransactionDb(id, workspace.id);
        } catch (err) {
          console.warn('Supabase delete warning:', err);
        }
      }
    },
    [workspace.id, transactions, persistTransactions]
  );

  const importTransactions = useCallback(
    async (newTransactions: Transaction[]): Promise<CSVImportResult> => {
      const updated = [...newTransactions, ...transactions];
      persistTransactions(updated);

      if (isSupabaseConfigured) {
        try {
          const success = await bulkInsertTransactionsDb(newTransactions, workspace.id);
          if (success) {
            const dbTxs = await fetchTransactionsFromDb(workspace.id);
            if (dbTxs && dbTxs.length > 0) {
              persistTransactions(dbTxs);
            }
          }
        } catch (err) {
          console.warn('Supabase bulk insert warning:', err);
        }
      }

      return {
        totalRows: newTransactions.length,
        importedRows: newTransactions.length,
        failedRows: 0,
        errors: [],
        transactions: newTransactions,
      };
    },
    [workspace.id, transactions, persistTransactions]
  );

  // Alert Management
  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      const updated = alerts.map((a) =>
        a.id === alertId
          ? { ...a, status: 'acknowledged' as const, acknowledged_at: new Date().toISOString() }
          : a
      );
      persistAlerts(updated);

      if (isSupabaseConfigured) {
        try {
          await acknowledgeAlertDb(alertId, workspace.id);
        } catch (err) {
          console.warn('Supabase alert ack warning:', err);
        }
      }
    },
    [alerts, workspace.id, persistAlerts]
  );

  const markAllAlertsRead = useCallback(async () => {
    const updated = alerts.map((a) => ({
      ...a,
      status: 'acknowledged' as const,
      acknowledged_at: new Date().toISOString(),
    }));
    persistAlerts(updated);

    if (isSupabaseConfigured) {
      try {
        await markAllAlertsReadDb(workspace.id);
      } catch (err) {
        console.warn('Supabase alert read warning:', err);
      }
    }
  }, [alerts, workspace.id, persistAlerts]);

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

  const resetToDemoData = useCallback(() => {
    persistTransactions(DEMO_TRANSACTIONS);
    persistAlerts(DEMO_ALERTS);
    setWorkspace(DEMO_WORKSPACE);
    setUser(DEMO_USER);
  }, [persistTransactions, persistAlerts]);

  // Export transactions CSV
  const exportTransactionsCSV = useCallback(() => {
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
  }, [transactions]);

  // Export Executive Financial Summary
  const exportReportJSON = useCallback(() => {
    const summary = {
      workspace: workspace.name,
      generated_at: new Date().toISOString(),
      kpis,
      expenseBreakdown,
      cashFlowProjection,
      activeAlertsCount: alerts.filter((a) => a.status === 'active').length,
      recentTransactions: transactions.slice(0, 10),
    };
    return JSON.stringify(summary, null, 2);
  }, [workspace.name, kpis, expenseBreakdown, cashFlowProjection, alerts, transactions]);

  const value = useMemo(
    () => ({
      workspace,
      workspaces,
      user,
      transactions,
      alerts,
      alertPreferences,
      kpis,
      cashFlowProjection,
      expenseBreakdown,
      isLoading,
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
    }),
    [
      workspace,
      workspaces,
      user,
      transactions,
      alerts,
      alertPreferences,
      kpis,
      cashFlowProjection,
      expenseBreakdown,
      isLoading,
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
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export function useFinance(): FinanceContextType {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
