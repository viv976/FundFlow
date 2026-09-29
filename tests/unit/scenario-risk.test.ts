import { describe, it, expect } from 'vitest';
import {
  deriveBaselineFromTransactions,
  calculateScenarioModel,
  DEFAULT_SCENARIO_ASSUMPTIONS,
  createSavedScenarioModel,
  restoreScenarioAssumptions,
} from '@/lib/finance/scenario-engine';
import {
  evaluateRiskSignals,
} from '@/lib/finance/risk-engine';
import { Transaction, Workspace, ScenarioAssumptions } from '@/types/finance';

const mockWorkspace: Workspace = {
  id: 'ws-test-group6',
  owner_id: 'user-test-owner',
  name: 'Test Group 6 Workspace',
  currency: 'USD',
  starting_cash: 100000,
  alert_runway_threshold: 6.0,
  created_at: '2026-01-01T00:00:00Z',
};


function makeTx(
  partial: Partial<Transaction> & {
    id: string;
    amount: number;
    transaction_type: 'income' | 'expense';
    category: string;
    transaction_date: string;
    description: string;
  }
): Transaction {
  return {
    workspace_id: mockWorkspace.id,
    currency: 'USD',
    source: 'manual',
    status: 'completed',
    ...partial,
  };
}

describe('Group 6: Scenario Planning Engine', () => {
  it('calculates baseline scenario deterministically from ledger transactions', () => {
    // 3 completed months of verified ledger:
    // Month 1 (2026-05): Inflow 10,000, Outflow 30,000 -> Net Burn 20,000
    // Month 2 (2026-06): Inflow 10,000, Outflow 30,000 -> Net Burn 20,000
    // Month 3 (2026-07): Inflow 10,000, Outflow 30,000 -> Net Burn 20,000
    // Reporting anchor (2026-08): Active month
    const txs: Transaction[] = [
      makeTx({ id: '1', amount: 10000, transaction_type: 'income', category: 'Revenue', transaction_date: '2026-05-15', description: 'Rev May' }),
      makeTx({ id: '2', amount: 30000, transaction_type: 'expense', category: 'Operations', transaction_date: '2026-05-20', description: 'Exp May' }),
      makeTx({ id: '3', amount: 10000, transaction_type: 'income', category: 'Revenue', transaction_date: '2026-06-15', description: 'Rev Jun' }),
      makeTx({ id: '4', amount: 30000, transaction_type: 'expense', category: 'Operations', transaction_date: '2026-06-20', description: 'Exp Jun' }),
      makeTx({ id: '5', amount: 10000, transaction_type: 'income', category: 'Revenue', transaction_date: '2026-07-15', description: 'Rev Jul' }),
      makeTx({ id: '6', amount: 30000, transaction_type: 'expense', category: 'Operations', transaction_date: '2026-07-20', description: 'Exp Jul' }),
      makeTx({ id: '7', amount: 5000, transaction_type: 'expense', category: 'Operations', transaction_date: '2026-08-01', description: 'Exp Aug' }),
    ];

    const baseline = deriveBaselineFromTransactions(txs, mockWorkspace);

    // Total cash: starting_cash(100,000) + 30,000(inflows) - 95,000(outflows) = 35,000
    expect(baseline.cash).toBe(35000);
    expect(baseline.monthlyRevenue).toBe(10000);
    expect(baseline.monthlyExpenses).toBe(30000);
    expect(baseline.monthlyNetBurn).toBe(20000);
    // Runway: 35,000 / 20,000 = 1.75 -> rounded to 1.8 months
    expect(baseline.runwayMonths).toBe(1.8);
    expect(baseline.isCashFlowPositive).toBe(false);

    // Test zero-delta calculation matches baseline
    const result = calculateScenarioModel(baseline, DEFAULT_SCENARIO_ASSUMPTIONS);
    expect(result.scenario.monthlyNetBurn).toBe(baseline.monthlyNetBurn);
    expect(result.scenario.runwayMonths).toBe(baseline.runwayMonths);
    expect(result.delta.netBurnDelta).toBe(0);
    expect(result.delta.runwayDeltaMonths).toBe(0);
    expect(result.methodology.steps.length).toBeGreaterThan(0);
  });

  it('evaluates increased expenses deterministically (hiring, marketing, infra)', () => {
    const baseline = {
      cash: 100000,
      monthlyRevenue: 20000,
      monthlyExpenses: 30000,
      monthlyNetBurn: 10000,
      runwayMonths: 10.0,
      isCashFlowPositive: false,
      currency: 'USD',
    };

    // Scenario: Add 2 hires @ $10,000/mo ($20,000), +$5,000 marketing, +$2,000 infra, +$3,000 ops
    // Total incremental cost = 20,000 + 5,000 + 2,000 + 3,000 = 30,000
    const scenario = calculateScenarioModel(baseline, {
      hiringCount: 2,
      hiringCostPerRole: 10000,
      marketingSpendDelta: 5000,
      infrastructureSpendDelta: 2000,
      monthlyExpensesDelta: 3000,
    });

    expect(scenario.scenario.totalIncrementalCost).toBe(30000);
    expect(scenario.scenario.monthlyExpenses).toBe(60000);
    // New net burn: 60,000 - 20,000 = 40,000
    expect(scenario.scenario.monthlyNetBurn).toBe(40000);
    // New runway: 100,000 / 40,000 = 2.5 months
    expect(scenario.scenario.runwayMonths).toBe(2.5);
    // Delta burn: +30,000/mo
    expect(scenario.delta.netBurnDelta).toBe(30000);
    // Delta runway: 2.5 - 10.0 = -7.5 months
    expect(scenario.delta.runwayDeltaMonths).toBe(-7.5);
    expect(scenario.delta.runwayImpactDescription).toContain('Compresses runway');
  });

  it('evaluates decreased revenue impact on burn and runway', () => {
    const baseline = {
      cash: 120000,
      monthlyRevenue: 40000,
      monthlyExpenses: 50000,
      monthlyNetBurn: 10000,
      runwayMonths: 12.0,
      isCashFlowPositive: false,
      currency: 'USD',
    };

    // Scenario: -25% MoM revenue growth rate and -$5,000 contract loss
    // Revenue delta = (40,000 * -0.25) + (-5,000) = -10,000 - 5,000 = -15,000
    const scenario = calculateScenarioModel(baseline, {
      revenueGrowthRateMoM: -25,
      additionalMonthlyRevenue: -5000,
    });

    expect(scenario.scenario.monthlyRevenue).toBe(25000);
    expect(scenario.delta.revenueDelta).toBe(-15000);
    // New net burn: 50,000 - 25,000 = 25,000
    expect(scenario.scenario.monthlyNetBurn).toBe(25000);
    // New runway: 120,000 / 25,000 = 4.8 months
    expect(scenario.scenario.runwayMonths).toBe(4.8);
    // Runway delta: 4.8 - 12.0 = -7.2 months
    expect(scenario.delta.runwayDeltaMonths).toBe(-7.2);
  });

  it('evaluates negative cash trajectory over 12 months with depletion horizon', () => {
    const baseline = {
      cash: 50000,
      monthlyRevenue: 10000,
      monthlyExpenses: 25000,
      monthlyNetBurn: 15000,
      runwayMonths: 3.3,
      isCashFlowPositive: false,
      currency: 'USD',
    };

    const scenario = calculateScenarioModel(baseline, {
      monthlyExpensesDelta: 5000, // increases net burn to 20,000
    });

    expect(scenario.trajectory.length).toBe(12);

    // Month 1: 50,000 - 20,000 = 30,000
    expect(scenario.trajectory[0].scenarioCash).toBe(30000);
    // Month 2: 30,000 - 20,000 = 10,000
    expect(scenario.trajectory[1].scenarioCash).toBe(10000);
    // Month 3: 10,000 - 20,000 = 0 (bounded at 0)
    expect(scenario.trajectory[2].scenarioCash).toBe(0);
    // Month 4: 0
    expect(scenario.trajectory[3].scenarioCash).toBe(0);
  });

  it('handles insufficient data gracefully without crashing or NaN', () => {
    const baseline = deriveBaselineFromTransactions([], mockWorkspace);
    expect(baseline.cash).toBe(100000);
    expect(baseline.monthlyRevenue).toBe(0);
    expect(baseline.monthlyExpenses).toBe(0);
    expect(baseline.monthlyNetBurn).toBe(0);
    expect(baseline.runwayMonths).toBe(999);
    expect(baseline.isCashFlowPositive).toBe(true);

    const scenario = calculateScenarioModel(baseline, {});
    expect(scenario.scenario.monthlyNetBurn).toBe(0);
    expect(scenario.scenario.runwayMonths).toBe(999);
    expect(Number.isNaN(scenario.scenario.runwayMonths)).toBe(false);
  });

  it('guarantees ledger immutability: scenario calculation never mutates real transactions', () => {
    const originalTxs: Transaction[] = [
      makeTx({ id: 'tx-1', amount: 15000, transaction_type: 'income', category: 'Revenue', transaction_date: '2026-05-10', description: 'Client Retainer' }),
      makeTx({ id: 'tx-2', amount: 4500, transaction_type: 'expense', category: 'Operations', transaction_date: '2026-05-15', description: 'Server Cluster' }),
      makeTx({ id: 'tx-3', amount: 8000, transaction_type: 'expense', category: 'Payroll', transaction_date: '2026-06-01', description: 'Contractor Dev' }),
    ];

    // Deep snapshot before calculation
    const snapshotBefore = JSON.parse(JSON.stringify(originalTxs));

    // Run baseline derivation and scenario calculation across all public boundaries
    const baseline = deriveBaselineFromTransactions(originalTxs, mockWorkspace);
    const scenarioResult = calculateScenarioModel(baseline, {
      monthlyExpensesDelta: 5000,
      hiringCount: 2,
      hiringCostPerRole: 10000,
      marketingSpendDelta: 3000,
      revenueGrowthRateMoM: 15,
      additionalMonthlyRevenue: 2000,
    });

    expect(scenarioResult).toBeDefined();

    // Verify original transactions were untouched in every field, length, and order
    expect(originalTxs).toEqual(snapshotBefore);
    expect(originalTxs.length).toBe(snapshotBefore.length);
    originalTxs.forEach((tx, idx) => {
      expect(tx).toEqual(snapshotBefore[idx]);
      expect(tx.id).toBe(snapshotBefore[idx].id);
      expect(tx.amount).toBe(snapshotBefore[idx].amount);
      expect(tx.status).toBe(snapshotBefore[idx].status);
      expect(tx.transaction_date).toBe(snapshotBefore[idx].transaction_date);
      expect(tx.category).toBe(snapshotBefore[idx].category);
      expect(tx.transaction_type).toBe(snapshotBefore[idx].transaction_type);
      expect(tx.description).toBe(snapshotBefore[idx].description);
    });
  });
});


describe('Group 6: Risk Intelligence Engine', () => {
  it('detects RUNWAY_BELOW_THRESHOLD (critical < 3 mos, warning < 6 mos)', () => {
    const txs: Transaction[] = [
      makeTx({ id: 't1', amount: 10000, transaction_type: 'income', category: 'Rev', transaction_date: '2026-05-10', description: 'Rev' }),
      makeTx({ id: 't2', amount: 30000, transaction_type: 'expense', category: 'Payroll', transaction_date: '2026-05-15', description: 'Exp' }),
      makeTx({ id: 't3', amount: 10000, transaction_type: 'income', category: 'Rev', transaction_date: '2026-06-10', description: 'Rev' }),
      makeTx({ id: 't4', amount: 30000, transaction_type: 'expense', category: 'Payroll', transaction_date: '2026-06-15', description: 'Exp' }),
      makeTx({ id: 't5', amount: 1000, transaction_type: 'expense', category: 'Tools', transaction_date: '2026-07-01', description: 'Exp' }),
    ];

    // Starting cash 80K -> total net outflow = 41K -> current cash = 39K
    // Average completed burn = 20K/mo -> Runway = 39K / 20K = 1.95 mos (< 3.0 mos critical)
    const criticalAlerts = evaluateRiskSignals(txs, { ...mockWorkspace, starting_cash: 80000 });
    const runwayAlert = criticalAlerts.find((a) => a.ruleId === 'RUNWAY_BELOW_THRESHOLD');

    expect(runwayAlert).toBeDefined();
    expect(runwayAlert?.severity).toBe('critical');
    expect(runwayAlert?.detectionMechanism).toBe('DETERMINISTIC_DETECTION');
    expect(runwayAlert?.title).toContain('Critical Runway');
    expect(runwayAlert?.supportingData.primaryMetric).toContain('Runway:');
    expect(runwayAlert?.affectedPeriod).toBeDefined();
    expect(runwayAlert?.suggestedAction).toBeDefined();

    // With 150K starting cash -> cash = 109K -> runway = 109K / 20K = 5.45 mos (< 6.0 mos warning)
    const warningAlerts = evaluateRiskSignals(txs, { ...mockWorkspace, starting_cash: 150000 });
    const warningRunwayAlert = warningAlerts.find((a) => a.ruleId === 'RUNWAY_BELOW_THRESHOLD');
    expect(warningRunwayAlert).toBeDefined();
    expect(warningRunwayAlert?.severity).toBe('warning');
  });

  it('detects RAPIDLY_INCREASING_BURN when burn surges > 25% MoM', () => {
    // Completed month 1: Burn 10K
    // Completed month 2: Burn 10K
    // Reporting anchor month (2026-07): Outflow 25K, Inflow 5K -> Net burn 20K (+100% surge)
    const txs: Transaction[] = [
      makeTx({ id: 't1', amount: 10000, transaction_type: 'expense', category: 'Ops', transaction_date: '2026-05-15', description: 'Exp' }),
      makeTx({ id: 't2', amount: 10000, transaction_type: 'expense', category: 'Ops', transaction_date: '2026-06-15', description: 'Exp' }),
      makeTx({ id: 't3', amount: 25000, transaction_type: 'expense', category: 'Ops', transaction_date: '2026-07-10', description: 'Exp' }),
      makeTx({ id: 't4', amount: 5000, transaction_type: 'income', category: 'Rev', transaction_date: '2026-07-15', description: 'Rev' }),
    ];

    const alerts = evaluateRiskSignals(txs, { ...mockWorkspace, starting_cash: 200000 });
    const burnAlert = alerts.find((a) => a.ruleId === 'RAPIDLY_INCREASING_BURN');

    expect(burnAlert).toBeDefined();
    expect(burnAlert?.detectionMechanism).toBe('DETERMINISTIC_DETECTION');
    expect(burnAlert?.supportingData.variancePercent).toBeGreaterThanOrEqual(25);
    expect(burnAlert?.explanation).toContain('surged');
  });

  it('detects REVENUE_DECLINE when completed MoM revenue drops > 15%', () => {
    // Month 1 (2026-05): Rev 20,000
    // Month 2 (2026-06): Rev 10,000 (-50% drop)
    // Anchor (2026-07)
    const txs: Transaction[] = [
      makeTx({ id: 't1', amount: 20000, transaction_type: 'income', category: 'Rev', transaction_date: '2026-05-15', description: 'May Rev' }),
      makeTx({ id: 't2', amount: 10000, transaction_type: 'income', category: 'Rev', transaction_date: '2026-06-15', description: 'Jun Rev' }),
      makeTx({ id: 't3', amount: 2000, transaction_type: 'income', category: 'Rev', transaction_date: '2026-07-01', description: 'Jul Rev' }),
    ];

    const alerts = evaluateRiskSignals(txs, mockWorkspace);
    const revAlert = alerts.find((a) => a.ruleId === 'REVENUE_DECLINE');

    expect(revAlert).toBeDefined();
    expect(revAlert?.detectionMechanism).toBe('DETERMINISTIC_DETECTION');
    expect(revAlert?.title).toContain('Revenue Decline');
    expect(revAlert?.affectedPeriod).toContain('2026-05 → 2026-06');
  });

  it('detects EXPENSE_CONCENTRATION when a single category exceeds 50% of monthly spend', () => {
    const txs: Transaction[] = [
      makeTx({ id: 't1', amount: 40000, transaction_type: 'expense', category: 'Legal Fees', transaction_date: '2026-07-10', description: 'Counsel' }),
      makeTx({ id: 't2', amount: 10000, transaction_type: 'expense', category: 'Software', transaction_date: '2026-07-12', description: 'SaaS' }),
    ];

    const alerts = evaluateRiskSignals(txs, mockWorkspace);
    const concentrationAlert = alerts.find((a) => a.ruleId === 'EXPENSE_CONCENTRATION');

    expect(concentrationAlert).toBeDefined();
    expect(concentrationAlert?.detectionMechanism).toBe('DETERMINISTIC_DETECTION');
    expect(concentrationAlert?.title).toContain('Legal Fees');
    expect(concentrationAlert?.supportingData.primaryMetric).toContain('80.0%');
  });

  it('strictly respects the 50% concentration threshold boundary (exceeds semantics)', () => {
    // Total monthly outflow: 10,000 across 3 categories
    // Case 1: Highest category at 49.9% (4,990 / 10,000) -> strictly below threshold -> NO alert
    const txsBelow: Transaction[] = [
      makeTx({ id: 'b1', amount: 4990, transaction_type: 'expense', category: 'Legal Fees', transaction_date: '2026-07-10', description: 'Counsel' }),
      makeTx({ id: 'b2', amount: 2510, transaction_type: 'expense', category: 'General Ops', transaction_date: '2026-07-12', description: 'Rent' }),
      makeTx({ id: 'b3', amount: 2500, transaction_type: 'expense', category: 'Cloud', transaction_date: '2026-07-15', description: 'Servers' }),
    ];
    const alertsBelow = evaluateRiskSignals(txsBelow, mockWorkspace);
    expect(alertsBelow.find((a) => a.ruleId === 'EXPENSE_CONCENTRATION')).toBeUndefined();

    // Case 2: Highest category exactly at 50.0% (5,000 / 10,000) -> exactly at threshold -> NO alert (exceeds means > 50%)
    const txsExact: Transaction[] = [
      makeTx({ id: 'e1', amount: 5000, transaction_type: 'expense', category: 'Legal Fees', transaction_date: '2026-07-10', description: 'Counsel' }),
      makeTx({ id: 'e2', amount: 2500, transaction_type: 'expense', category: 'General Ops', transaction_date: '2026-07-12', description: 'Rent' }),
      makeTx({ id: 'e3', amount: 2500, transaction_type: 'expense', category: 'Cloud', transaction_date: '2026-07-15', description: 'Servers' }),
    ];
    const alertsExact = evaluateRiskSignals(txsExact, mockWorkspace);
    expect(alertsExact.find((a) => a.ruleId === 'EXPENSE_CONCENTRATION')).toBeUndefined();

    // Case 3: Highest category at 50.1% (5,010 / 10,000) -> strictly exceeds 50.0% -> ALERT triggers
    const txsAbove: Transaction[] = [
      makeTx({ id: 'a1', amount: 5010, transaction_type: 'expense', category: 'Legal Fees', transaction_date: '2026-07-10', description: 'Counsel' }),
      makeTx({ id: 'a2', amount: 2500, transaction_type: 'expense', category: 'General Ops', transaction_date: '2026-07-12', description: 'Rent' }),
      makeTx({ id: 'a3', amount: 2490, transaction_type: 'expense', category: 'Cloud', transaction_date: '2026-07-15', description: 'Servers' }),
    ];
    const alertsAbove = evaluateRiskSignals(txsAbove, mockWorkspace);
    const concentrationAlert = alertsAbove.find((a) => a.ruleId === 'EXPENSE_CONCENTRATION');
    expect(concentrationAlert).toBeDefined();
    expect(concentrationAlert?.title).toContain('Legal Fees');
    expect(concentrationAlert?.supportingData.primaryMetric).toContain('50.1%');
  });



  it('detects UNUSUAL_EXPENSE_SPIKE against trailing completed category baseline', () => {
    // May Cloud: 2,000
    // Jun Cloud: 2,000
    // Jul Cloud: 8,000 (+300% spike, > $2,000 delta)
    const txs: Transaction[] = [
      makeTx({ id: 't1', amount: 2000, transaction_type: 'expense', category: 'Cloud Hosting', transaction_date: '2026-05-15', description: 'Cloud' }),
      makeTx({ id: 't2', amount: 2000, transaction_type: 'expense', category: 'Cloud Hosting', transaction_date: '2026-06-15', description: 'Cloud' }),
      makeTx({ id: 't3', amount: 8000, transaction_type: 'expense', category: 'Cloud Hosting', transaction_date: '2026-07-10', description: 'GPU Cluster' }),
    ];

    const alerts = evaluateRiskSignals(txs, mockWorkspace);
    const spikeAlert = alerts.find((a) => a.ruleId === 'UNUSUAL_EXPENSE_SPIKE');

    expect(spikeAlert).toBeDefined();
    expect(spikeAlert?.title).toContain('Cloud Hosting');
    expect(spikeAlert?.supportingData.variancePercent).toBe(300);
  });

  it('detects ABNORMAL_TRANSACTION when single debit exceeds 25% of monthly outflow', () => {
    const txs: Transaction[] = [
      makeTx({ id: 't1', amount: 15000, transaction_type: 'expense', category: 'Equipment', transaction_date: '2026-07-05', description: 'Massive Server Purchase' }),
      makeTx({ id: 't2', amount: 5000, transaction_type: 'expense', category: 'Office', transaction_date: '2026-07-10', description: 'Supplies' }),
      makeTx({ id: 't3', amount: 5000, transaction_type: 'expense', category: 'Travel', transaction_date: '2026-07-12', description: 'Flights' }),
    ];

    // Total monthly outflow: 25,000. 15,000 is 60% of monthly spend (> 25% threshold)
    const alerts = evaluateRiskSignals(txs, mockWorkspace);
    const abnormalAlert = alerts.find((a) => a.ruleId === 'ABNORMAL_TRANSACTION');

    expect(abnormalAlert).toBeDefined();
    expect(abnormalAlert?.detectionMechanism).toBe('DETERMINISTIC_DETECTION');
    expect(abnormalAlert?.severity).toBe('critical'); // > 50%
    expect(abnormalAlert?.title).toContain('Massive Server Purchase');
  });

  it('handles insufficient data cleanly in risk engine', () => {
    const alerts = evaluateRiskSignals([], mockWorkspace);
    expect(alerts).toEqual([]);
  });

  it('correctly packages and restores saved what-if scenario models (Load Model regression)', () => {
    const nonDefaultAssumptions: ScenarioAssumptions = {
      monthlyExpensesDelta: 12500, // +$12.5k ops
      revenueGrowthRateMoM: 18,    // +18% MoM
      additionalMonthlyRevenue: 6000, // +$6k MRR
      hiringCount: 4,              // 4 hires
      hiringCostPerRole: 15000,    // $15k per hire
      marketingSpendDelta: 7500,   // +$7.5k mktg
      infrastructureSpendDelta: 4000, // +$4k infra
    };

    // 1. Create / Save model
    const savedModel = createSavedScenarioModel('Q4 Aggressive Growth Plan', nonDefaultAssumptions);
    expect(savedModel.name).toBe('Q4 Aggressive Growth Plan');
    expect(savedModel.id).toBeDefined();
    expect(savedModel.createdAt).toBeDefined();

    // 2. Load / Restore model from saved record
    const restoredFromRecord = restoreScenarioAssumptions(savedModel);

    // 3. Assert EVERY single saved parameter is restored exactly
    expect(restoredFromRecord.monthlyExpensesDelta).toBe(12500);
    expect(restoredFromRecord.revenueGrowthRateMoM).toBe(18);
    expect(restoredFromRecord.additionalMonthlyRevenue).toBe(6000);
    expect(restoredFromRecord.hiringCount).toBe(4);
    expect(restoredFromRecord.hiringCostPerRole).toBe(15000);
    expect(restoredFromRecord.marketingSpendDelta).toBe(7500);
    expect(restoredFromRecord.infrastructureSpendDelta).toBe(4000);

    // Also assert direct assumptions object restore works identically
    const restoredDirect = restoreScenarioAssumptions(savedModel.assumptions);
    expect(restoredDirect).toEqual(restoredFromRecord);

    // 4. Assert calculated scenario uses the restored values
    const baseline = {
      cash: 200000,
      monthlyRevenue: 30000,
      monthlyExpenses: 50000,
      monthlyNetBurn: 20000,
      runwayMonths: 10.0,
      isCashFlowPositive: false,
      currency: 'USD',
    };

    const calculatedWithOriginal = calculateScenarioModel(baseline, nonDefaultAssumptions);
    const calculatedWithRestored = calculateScenarioModel(baseline, restoredFromRecord);

    expect(calculatedWithRestored.scenario.monthlyRevenue).toBe(calculatedWithOriginal.scenario.monthlyRevenue);
    expect(calculatedWithRestored.scenario.monthlyExpenses).toBe(calculatedWithOriginal.scenario.monthlyExpenses);
    expect(calculatedWithRestored.scenario.monthlyNetBurn).toBe(calculatedWithOriginal.scenario.monthlyNetBurn);
    expect(calculatedWithRestored.scenario.runwayMonths).toBe(calculatedWithOriginal.scenario.runwayMonths);
    expect(calculatedWithRestored.delta.netBurnDelta).toBe(calculatedWithOriginal.delta.netBurnDelta);
    expect(calculatedWithRestored.trajectory).toEqual(calculatedWithOriginal.trajectory);

    // Verify expected exact numbers:
    // Incremental costs: 12500 + (4 * 15000) + 7500 + 4000 = 84,000
    expect(calculatedWithRestored.scenario.totalIncrementalCost).toBe(84000);
    // Incremental revenue: round(30000 * 0.18) + 6000 = 5400 + 6000 = 11,400
    expect(calculatedWithRestored.scenario.totalIncrementalRevenue).toBe(11400);
    // New expenses: 50000 + 84000 = 134,000
    expect(calculatedWithRestored.scenario.monthlyExpenses).toBe(134000);
    // New revenue: 30000 + 11400 = 41,400
    expect(calculatedWithRestored.scenario.monthlyRevenue).toBe(41400);
    // New net burn: 134000 - 41400 = 92,600
    expect(calculatedWithRestored.scenario.monthlyNetBurn).toBe(92600);
    // New runway: round(200000 / 92600, 1) = 2.2 months
    expect(calculatedWithRestored.scenario.runwayMonths).toBe(2.2);

    // 5. Assert fallback defaults for partial or empty inputs
    const restoredEmpty = restoreScenarioAssumptions({});
    expect(restoredEmpty).toEqual(DEFAULT_SCENARIO_ASSUMPTIONS);
  });
});
