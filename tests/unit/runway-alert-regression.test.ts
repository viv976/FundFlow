import { describe, it, expect } from 'vitest';
import { shouldGenerateRunwayAlert } from '@/lib/store/finance-context';
import { calculateAllKPIs } from '@/lib/finance/calculator';
import { Workspace, Transaction, Alert, AlertPreferences } from '@/types/finance';

describe('Runway Risk Alert Regression Tests', () => {
  const defaultAlertPreferences: AlertPreferences = {
    workspace_id: 'ws-test',
    runway_threshold_months: 6.0,
    expense_spike_percentage: 40.0,
    cash_minimum_threshold: 50000.0,
    large_transaction_threshold: 10000.0,
    email_notifications_enabled: true,
    slack_notifications_enabled: false,
  };

  const emptyWorkspace: Workspace = {
    id: 'ws-new-empty',
    name: 'Brand New Startup',
    owner_id: 'user-new',
    currency: 'USD',
    starting_cash: 0,
    alert_runway_threshold: 6,
    created_at: '2026-03-01T00:00:00Z',
  };

  it('1. A new workspace with $0 starting cash and zero transactions does not receive an automatic runway alert', () => {
    const transactions: Transaction[] = [];
    const kpis = calculateAllKPIs(transactions, emptyWorkspace.starting_cash);

    // Baseline verification: calculateRunway produces 0 runway and !isCashFlowPositive for $0 cash
    expect(kpis.cashOnHand).toBe(0);
    expect(kpis.runwayMonths).toBe(0);
    expect(kpis.isCashFlowPositive).toBe(false);
    expect(kpis.hasSufficientData).toBe(false);

    // Verify shouldGenerateRunwayAlert suppresses the alert
    const shouldAlert = shouldGenerateRunwayAlert({
      kpis,
      alertPreferences: defaultAlertPreferences,
      workspace: emptyWorkspace,
      transactions,
      alerts: [],
    });

    expect(shouldAlert).toBe(false);
  });

  it('1b. A new workspace with undefined starting cash and zero transactions does not receive an automatic runway alert', () => {
    const workspaceUndefinedCash: Workspace = {
      ...emptyWorkspace,
      id: 'ws-undefined-cash',
      starting_cash: undefined,
    };
    const transactions: Transaction[] = [];
    const kpis = calculateAllKPIs(transactions, workspaceUndefinedCash.starting_cash);

    const shouldAlert = shouldGenerateRunwayAlert({
      kpis,
      alertPreferences: defaultAlertPreferences,
      workspace: workspaceUndefinedCash,
      transactions,
      alerts: [],
    });

    expect(shouldAlert).toBe(false);
  });

  it('2. A workspace with financial activity and genuinely insufficient runway still receives the appropriate alert', () => {
    const activeWorkspace: Workspace = {
      id: 'ws-active-deficit',
      name: 'Active Startup Running Low',
      owner_id: 'user-active',
      currency: 'USD',
      starting_cash: 50000,
      alert_runway_threshold: 6,
      created_at: '2025-01-01T00:00:00Z',
    };

    // 3 months of completed expenses: Jan, Feb, Mar with $15,000/mo expense ($45,000 total out of $50,000)
    // Remaining cash is $5,000, monthly net burn is $15,000 -> runway = 0.3 months (< 6 months threshold)
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        workspace_id: activeWorkspace.id,
        transaction_date: '2025-01-15',
        description: 'Office & Salaries Jan',
        amount: 15000,
        transaction_type: 'expense',
        category: 'Payroll',
        currency: 'USD',
        source: 'manual',
        status: 'completed',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
      },
      {
        id: 'tx-2',
        workspace_id: activeWorkspace.id,
        transaction_date: '2025-02-15',
        description: 'Office & Salaries Feb',
        amount: 15000,
        transaction_type: 'expense',
        category: 'Payroll',
        currency: 'USD',
        source: 'manual',
        status: 'completed',
        created_at: '2025-02-15T10:00:00Z',
        updated_at: '2025-02-15T10:00:00Z',
      },
      {
        id: 'tx-3',
        workspace_id: activeWorkspace.id,
        transaction_date: '2025-03-15',
        description: 'Office & Salaries Mar',
        amount: 15000,
        transaction_type: 'expense',
        category: 'Payroll',
        currency: 'USD',
        source: 'manual',
        status: 'completed',
        created_at: '2025-03-15T10:00:00Z',
        updated_at: '2025-03-15T10:00:00Z',
      },
    ];

    const kpis = calculateAllKPIs(transactions, activeWorkspace.starting_cash);

    expect(kpis.hasSufficientData).toBe(true);
    expect(kpis.cashOnHand).toBe(5000);
    expect(kpis.monthlyBurn).toBe(15000);
    expect(kpis.runwayMonths).toBeLessThan(6.0);
    expect(kpis.isCashFlowPositive).toBe(false);

    const shouldAlert = shouldGenerateRunwayAlert({
      kpis,
      alertPreferences: defaultAlertPreferences,
      workspace: activeWorkspace,
      transactions,
      alerts: [],
    });

    expect(shouldAlert).toBe(true);
  });

  it('2b. A workspace with zero starting cash but active expense transactions receives an alert', () => {
    const zeroCashActiveWorkspace: Workspace = {
      id: 'ws-zero-cash-active',
      name: 'Zero Starting Cash with Expenses',
      owner_id: 'user-active-2',
      currency: 'USD',
      starting_cash: 0,
      alert_runway_threshold: 6,
      created_at: '2025-01-01T00:00:00Z',
    };

    const transactions: Transaction[] = [
      {
        id: 'tx-zero-1',
        workspace_id: zeroCashActiveWorkspace.id,
        transaction_date: '2025-01-10',
        description: 'Server Costs',
        amount: 1000,
        transaction_type: 'expense',
        category: 'Cloud',
        currency: 'USD',
        source: 'manual',
        status: 'completed',
        created_at: '2025-01-10T10:00:00Z',
        updated_at: '2025-01-10T10:00:00Z',
      },
      {
        id: 'tx-zero-2',
        workspace_id: zeroCashActiveWorkspace.id,
        transaction_date: '2025-02-10',
        description: 'Server Costs',
        amount: 1000,
        transaction_type: 'expense',
        category: 'Cloud',
        currency: 'USD',
        source: 'manual',
        status: 'completed',
        created_at: '2025-02-10T10:00:00Z',
        updated_at: '2025-02-10T10:00:00Z',
      },
    ];

    const kpis = calculateAllKPIs(transactions, zeroCashActiveWorkspace.starting_cash);

    expect(kpis.hasSufficientData).toBe(true);
    expect(kpis.runwayMonths).toBeLessThan(6.0);
    expect(kpis.isCashFlowPositive).toBe(false);

    const shouldAlert = shouldGenerateRunwayAlert({
      kpis,
      alertPreferences: defaultAlertPreferences,
      workspace: zeroCashActiveWorkspace,
      transactions,
      alerts: [],
    });

    expect(shouldAlert).toBe(true);
  });

  it('3. Acknowledging an alert does not cause it to be recreated repeatedly for an empty workspace', () => {
    const transactions: Transaction[] = [];
    const kpis = calculateAllKPIs(transactions, emptyWorkspace.starting_cash);

    // Suppose an existing alert was present and is now acknowledged
    const acknowledgedAlert: Alert = {
      id: 'alert-runway-ack',
      workspace_id: emptyWorkspace.id,
      alert_type: 'runway_risk',
      severity: 'critical',
      title: 'Low Runway Warning: 0.0 Months Remaining',
      message: 'Current operational runway is below threshold.',
      status: 'acknowledged',
      created_at: '2026-03-01T00:00:00Z',
    };

    const alerts = [acknowledgedAlert];

    // When evaluated with the acknowledged alert, it must not trigger re-generation
    const shouldAlert = shouldGenerateRunwayAlert({
      kpis,
      alertPreferences: defaultAlertPreferences,
      workspace: emptyWorkspace,
      transactions,
      alerts,
    });

    expect(shouldAlert).toBe(false);

    // Even if alerts is subsequently cleared or empty, an empty workspace still never triggers runway alerts
    const shouldAlertCleared = shouldGenerateRunwayAlert({
      kpis,
      alertPreferences: defaultAlertPreferences,
      workspace: emptyWorkspace,
      transactions,
      alerts: [],
    });

    expect(shouldAlertCleared).toBe(false);
  });

  it('3b. Acknowledging an alert for an active workspace preserves acknowledged state without regenerating', () => {
    const activeWorkspace: Workspace = {
      id: 'ws-active-acknowledged',
      name: 'Active Workspace Ack',
      owner_id: 'user-active',
      currency: 'USD',
      starting_cash: 20000,
      alert_runway_threshold: 6,
      created_at: '2025-01-01T00:00:00Z',
    };

    const transactions: Transaction[] = [
      {
        id: 'tx-ack-1',
        workspace_id: activeWorkspace.id,
        transaction_date: '2025-01-10',
        description: 'Server Costs',
        amount: 8000,
        transaction_type: 'expense',
        category: 'Cloud',
        currency: 'USD',
        source: 'manual',
        status: 'completed',
        created_at: '2025-01-10T10:00:00Z',
        updated_at: '2025-01-10T10:00:00Z',
      },
      {
        id: 'tx-ack-2',
        workspace_id: activeWorkspace.id,
        transaction_date: '2025-02-10',
        description: 'Server Costs',
        amount: 8000,
        transaction_type: 'expense',
        category: 'Cloud',
        currency: 'USD',
        source: 'manual',
        status: 'completed',
        created_at: '2025-02-10T10:00:00Z',
        updated_at: '2025-02-10T10:00:00Z',
      },
    ];

    const kpis = calculateAllKPIs(transactions, activeWorkspace.starting_cash);

    // When alert is active, it should not generate a duplicate
    const activeAlert: Alert = {
      id: 'alert-runway-active',
      workspace_id: activeWorkspace.id,
      alert_type: 'runway_risk',
      severity: 'critical',
      title: 'Low Runway Warning',
      message: 'Runway is low',
      status: 'active',
      created_at: '2025-02-11T00:00:00Z',
    };

    expect(
      shouldGenerateRunwayAlert({
        kpis,
        alertPreferences: defaultAlertPreferences,
        workspace: activeWorkspace,
        transactions,
        alerts: [activeAlert],
      })
    ).toBe(false);

    // When the alert is marked acknowledged, it must still NOT generate another alert
    const acknowledgedAlert: Alert = {
      ...activeAlert,
      status: 'acknowledged',
    };

    expect(
      shouldGenerateRunwayAlert({
        kpis,
        alertPreferences: defaultAlertPreferences,
        workspace: activeWorkspace,
        transactions,
        alerts: [acknowledgedAlert],
      })
    ).toBe(false);
  });
});
