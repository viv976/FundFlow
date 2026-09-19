import { describe, it, expect } from 'vitest';
import {
  calculateCashOnHand,
  calculateMonthlyGrossOutflow,
  calculateMonthlyNetBurn,
  calculateMoMGrowth,
  calculateAllKPIs,
  calculateFinancialHealth,
  evaluateAttentionItems,
  generateCashFlowProjection,
  getMetricExplanation,
  getReportingAnchorAndCompletedMonths,
  formatCurrency,
  getCurrencySymbol,
  calculateWhatIfScenario,
} from '../../lib/finance';
import { Transaction, Workspace } from '../../types/finance';
import { mapDatabaseTransaction, mapAppTransactionToDb } from '../../lib/supabase/db';
import { DatabaseTransaction } from '../../lib/supabase/types';

const testWorkspace: Workspace = {
  id: 'ws-test-1',
  name: 'Test Venture Corp',
  owner_id: 'user-1',
  currency: 'USD',
  starting_cash: 1000000, // $1.0M
  alert_runway_threshold: 6.0,
  created_at: '2026-01-01T00:00:00Z',
};

describe('Group 4: Financial Intelligence Engine', () => {
  // 1. Reporting Anchor & Clock Independence
  describe('1. Reporting Anchor & Clock Independence', () => {
    it('determines reporting anchor month strictly from latest active transaction', () => {
      const txs: Transaction[] = [
        {
          id: 't1',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-01-15',
          description: 'Payroll',
          amount: 50000,
          transaction_type: 'expense',
          category: 'Payroll',
          currency: 'USD',
          source: 'manual',
          status: 'completed',
        },
        {
          id: 't2',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-04-10',
          description: 'Hosting',
          amount: 5000,
          transaction_type: 'expense',
          category: 'Cloud',
          currency: 'USD',
          source: 'manual',
          status: 'completed',
        },
      ];

      const { reportingAnchorMonth, completedMonths, k } = getReportingAnchorAndCompletedMonths(txs);
      expect(reportingAnchorMonth).toBe('2026-04');
      // Preceding months relative to 2026-04 are 2026-03, 2026-02, 2026-01
      expect(completedMonths).toEqual(['2026-03', '2026-02', '2026-01']);
      expect(k).toBe(3);
    });

    it('handles zero transactions gracefully with undefined anchor', () => {
      const { reportingAnchorMonth, completedMonths, k } = getReportingAnchorAndCompletedMonths([]);
      expect(reportingAnchorMonth).toBeUndefined();
      expect(completedMonths).toEqual([]);
      expect(k).toBe(0);
    });
  });

  // 2. Calendar-Gap Trailing-Window Test
  describe('2. Calendar-Gap Trailing-Window Rules', () => {
    it('correctly includes calendar gaps as 0-deficit months in trailing averages', () => {
      // Jan = $1000 expense, Feb = gap (no tx), Mar = $3000 expense, Apr = M0 (reporting anchor)
      const txs: Transaction[] = [
        {
          id: 't-jan',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-01-10',
          description: 'Software',
          amount: 1000,
          transaction_type: 'expense',
          category: 'Software',
          currency: 'USD',
          source: 'manual',
          status: 'completed',
        },
        {
          id: 't-mar',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-03-15',
          description: 'Legal',
          amount: 3000,
          transaction_type: 'expense',
          category: 'Legal',
          currency: 'USD',
          source: 'manual',
          status: 'completed',
        },
        {
          id: 't-apr',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-04-05',
          description: 'April Entry (M0)',
          amount: 500,
          transaction_type: 'expense',
          category: 'Office',
          currency: 'USD',
          source: 'manual',
          status: 'completed',
        },
      ];

      const { reportingAnchorMonth, completedMonths, k } = getReportingAnchorAndCompletedMonths(txs);
      expect(reportingAnchorMonth).toBe('2026-04');
      expect(completedMonths).toEqual(['2026-03', '2026-02', '2026-01']);
      expect(k).toBe(3);

      // Average Outflow: (3000 in Mar + 0 in Feb + 1000 in Jan) / 3 = 4000 / 3 = 1333.33 -> 1333
      const avgOutflow = calculateMonthlyGrossOutflow(txs, 3);
      expect(avgOutflow).toBe(1333);

      // Net burn: with 0 income, deficits are 3000, 0, 1000 -> average = 1333
      const avgNetBurn = calculateMonthlyNetBurn(txs, 3);
      expect(avgNetBurn).toBe(1333);
    });
  });

  // 3. Transaction Status Semantics
  describe('3. Transaction Status Semantics', () => {
    it('includes completed, pending, and reconciled transactions while excluding failed', () => {
      const txs: Transaction[] = [
        {
          id: 't1',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-01-10',
          description: 'Completed Income',
          amount: 10000,
          transaction_type: 'income',
          category: 'Revenue',
          currency: 'USD',
          source: 'manual',
          status: 'completed',
        },
        {
          id: 't2',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-01-12',
          description: 'Pending Income',
          amount: 5000,
          transaction_type: 'income',
          category: 'Revenue',
          currency: 'USD',
          source: 'manual',
          status: 'pending',
        },
        {
          id: 't3',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-01-14',
          description: 'Reconciled Expense',
          amount: 3000,
          transaction_type: 'expense',
          category: 'Payroll',
          currency: 'USD',
          source: 'manual',
          status: 'reconciled',
        },
        {
          id: 't4',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-01-15',
          description: 'Failed Expense Charge',
          amount: 99999,
          transaction_type: 'expense',
          category: 'Payroll',
          currency: 'USD',
          source: 'manual',
          status: 'failed',
        },
      ];

      // Starting cash 100,000 + (10000 + 5000) - 3000 = 112000
      const cash = calculateCashOnHand(txs, 100000);
      expect(cash).toBe(112000);
    });

    it('database mapping preserves status across completed, pending, failed, and reconciled', () => {
      const statuses = ['completed', 'pending', 'failed', 'reconciled'] as const;

      for (const st of statuses) {
        // App to DB
        const dbRow = mapAppTransactionToDb(
          {
            transaction_date: '2026-01-10',
            description: `Tx ${st}`,
            amount: 500,
            transaction_type: 'expense',
            category: 'Cloud',
            currency: 'USD',
            status: st,
            source: 'manual',
          },
          'ws-test-1',
          'tx-id-1'
        );
        expect(dbRow.status).toBe(st);

        // DB to App
        const appTx = mapDatabaseTransaction({
          id: 'tx-id-1',
          workspace_id: 'ws-test-1',
          transaction_date: '2026-01-10',
          amount: 500,
          transaction_type: 'expense',
          category_id: null,
          category: 'Cloud',
          merchant: null,
          description: `Tx ${st}`,
          account_name: null,
          currency: 'USD',
          status: st,
          source: 'Manual',
          source_file_id: null,
          is_recurring: false,
          created_by: null,
          created_at: '2026-01-10T10:00:00Z',
          updated_at: '2026-01-10T10:00:00Z',
        });
        expect(appTx.status).toBe(st);
      }

      // Default fallback if status is missing or unrecognized in DB
      const defaultAppTx = mapDatabaseTransaction({
        id: 'tx-id-2',
        workspace_id: 'ws-test-1',
        transaction_date: '2026-01-10',
        amount: 500,
        transaction_type: 'expense',
        category_id: null,
        category: 'Cloud',
        merchant: null,
        description: 'Missing status',
        account_name: null,
        currency: 'USD',
        source: 'Manual',
        source_file_id: null,
        is_recurring: false,
        created_by: null,
        created_at: '2026-01-10T10:00:00Z',
        updated_at: '2026-01-10T10:00:00Z',
      });
      expect(defaultAppTx.status).toBe('completed');
    });

    it('excludes failed transactions from net burn, runway, and health while pending and reconciled are active', () => {
      // Completed month 2026-01:
      // Income: $10,000 (completed)
      // Expenses: $3,000 (pending) + $2,000 (reconciled) = $5,000 active expense -> Net Deficit = $0 (operating positive)
      // Failed Expense: $50,000 (failed) -> MUST BE EXCLUDED
      // Anchor month 2026-02:
      // Active expense $1,000 (completed)
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-10', description: 'Rev', amount: 10000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws', transaction_date: '2026-01-12', description: 'Pending Exp', amount: 3000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'pending' },
        { id: '3', workspace_id: 'ws', transaction_date: '2026-01-14', description: 'Reconciled Exp', amount: 2000, transaction_type: 'expense', category: 'Office', currency: 'USD', source: 'manual', status: 'reconciled' },
        { id: '4', workspace_id: 'ws', transaction_date: '2026-01-15', description: 'Failed Huge Exp', amount: 50000, transaction_type: 'expense', category: 'Equipment', currency: 'USD', source: 'manual', status: 'failed' },
        { id: '5', workspace_id: 'ws', transaction_date: '2026-02-05', description: 'M0 Exp', amount: 1000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];

      // Cash: 100,000 + 10,000 - 3,000 - 2,000 - 1,000 = 104,000 (failed 50,000 excluded)
      const cash = calculateCashOnHand(txs, 100000);
      expect(cash).toBe(104000);

      // Trailing Net Burn in 2026-01:
      // Active inflow = $10,000, active outflow = $5,000 -> Deficit = 0.
      // If failed was included, outflow would be $55,000 -> Deficit would be $45,000.
      const netBurn = calculateMonthlyNetBurn(txs);
      expect(netBurn).toBe(0);

      // All KPIs
      const kpis = calculateAllKPIs(txs, 100000);
      expect(kpis.isCashFlowPositive).toBe(true);
      expect(kpis.monthlyBurn).toBe(0);
      expect(kpis.runwayDisplay).toBe('Cash-Flow Positive');

      // Financial Health Efficiency Factor
      const health = calculateFinancialHealth(txs, 100000);
      expect(health.score).not.toBeNull();
      const efficiencyFactor = health.factors.find((f) => f.name === 'Operating Efficiency');
      // Inflow ($10k) >= Outflow ($5k) -> Coverage ratio 2.0 >= 1.0 -> 25/25 pts
      expect(efficiencyFactor?.score).toBe(25);
    });
  });

  // 4. Health Category Independence
  describe('4. Health Category Independence', () => {
    it('allows a company with runway < 12 mos to score Strong (>= 80) based on all factors', () => {
      // Dataset 1:
      // Month 1 (2026-01): Income $100k, Expense $105k (net deficit $5k)
      // Month 2 (2026-02): Income $120k, Expense $120k (net deficit $0)
      // Month 3 (2026-03): Income $150k, Expense $130k (net deficit $0)
      // Month 4 (2026-04): M0
      // Net burn average = (0 + 0 + 5k)/3 = 1667/mo
      // With $15,000 cash -> runway is ~9 months (< 12 months)
      // Runway factor score for 9 mos is ~22/40
      // Efficiency: $370k / $355k >= 1.0 -> 25/25
      // Concentration: balanced across 4 categories -> 20/20
      // Growth: $120k to $150k (+25%) -> 15/15
      // Total score = 22 + 25 + 20 + 15 = 82 -> Category: Strong
      const txs: Transaction[] = [
        // 2026-01
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-10', description: 'Rev', amount: 100000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws', transaction_date: '2026-01-12', description: 'A', amount: 35000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws', transaction_date: '2026-01-12', description: 'B', amount: 35000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '4', workspace_id: 'ws', transaction_date: '2026-01-12', description: 'C', amount: 35000, transaction_type: 'expense', category: 'Marketing', currency: 'USD', source: 'manual', status: 'completed' },
        // 2026-02
        { id: '5', workspace_id: 'ws', transaction_date: '2026-02-10', description: 'Rev', amount: 120000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '6', workspace_id: 'ws', transaction_date: '2026-02-12', description: 'A', amount: 40000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '7', workspace_id: 'ws', transaction_date: '2026-02-12', description: 'B', amount: 40000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '8', workspace_id: 'ws', transaction_date: '2026-02-12', description: 'C', amount: 40000, transaction_type: 'expense', category: 'Marketing', currency: 'USD', source: 'manual', status: 'completed' },
        // 2026-03
        { id: '9', workspace_id: 'ws', transaction_date: '2026-03-10', description: 'Rev', amount: 150000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '10', workspace_id: 'ws', transaction_date: '2026-03-12', description: 'A', amount: 45000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '11', workspace_id: 'ws', transaction_date: '2026-03-12', description: 'B', amount: 45000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '12', workspace_id: 'ws', transaction_date: '2026-03-12', description: 'C', amount: 40000, transaction_type: 'expense', category: 'Marketing', currency: 'USD', source: 'manual', status: 'completed' },
        // 2026-04 (M0)
        { id: '13', workspace_id: 'ws', transaction_date: '2026-04-01', description: 'Entry', amount: 1000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
      ];

      // Pass starting balance so current cash is $15,000 (runway ~9 mos)
      // Net flow across txs: (100+120+150+1) - (105+120+130) = 371 - 355 = +16k
      // With starting balance -1000, current cash = 15,000
      const health = calculateFinancialHealth(txs, -1000);
      expect(health.score).toBeGreaterThanOrEqual(80);
      expect(health.category).toBe('Strong');
    });

    it('classifies a company with runway > 12 mos as Watchlist if other factors are poor', () => {
      // Dataset 2: 24 months runway (40 pts), but $0 revenue (4 pts), 95% spend in 1 category (2 pts), pre-revenue (3 pts) -> total = 49 pts -> Watchlist
      const txs: Transaction[] = [
        // 2026-01: $10k spend in Payroll
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-10', description: 'P', amount: 10000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        // 2026-02: $10k spend in Payroll
        { id: '2', workspace_id: 'ws', transaction_date: '2026-02-10', description: 'P', amount: 10000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        // 2026-03: $10k spend in Payroll
        { id: '3', workspace_id: 'ws', transaction_date: '2026-03-10', description: 'P', amount: 10000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        // 2026-04: M0
        { id: '4', workspace_id: 'ws', transaction_date: '2026-04-01', description: 'P', amount: 1000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
      ];

      // Net burn is $10k/mo. With starting cash $160,000 -> cash on hand = $129,000 (~13 mos runway)
      // Runway score = ~31/40. Efficiency: 4/25. Concentration: 2/20. Growth: 8/15. Total = ~45 -> Watchlist
      const health = calculateFinancialHealth(txs, 160000);
      expect(health.score).toBeLessThan(60);
      expect(health.category).toBe('Watchlist');
    });
  });

  // 5. Distinct Concentration Windows
  describe('5. Distinct Concentration Windows', () => {
    it('evaluates Health Concentration across completed months, and Attention Alert strictly in M0', () => {
      const txs: Transaction[] = [
        // Completed months M-3, M-2, M-1: balanced spend (33% Cloud, 33% Payroll, 34% Marketing)
        { id: '1', workspace_id: 'ws-test-1', transaction_date: '2026-01-10', description: 'A', amount: 10000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws-test-1', transaction_date: '2026-01-10', description: 'B', amount: 10000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws-test-1', transaction_date: '2026-01-10', description: 'C', amount: 10000, transaction_type: 'expense', category: 'Marketing', currency: 'USD', source: 'manual', status: 'completed' },

        { id: '4', workspace_id: 'ws-test-1', transaction_date: '2026-02-10', description: 'A', amount: 10000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '5', workspace_id: 'ws-test-1', transaction_date: '2026-02-10', description: 'B', amount: 10000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '6', workspace_id: 'ws-test-1', transaction_date: '2026-02-10', description: 'C', amount: 10000, transaction_type: 'expense', category: 'Marketing', currency: 'USD', source: 'manual', status: 'completed' },

        { id: '7', workspace_id: 'ws-test-1', transaction_date: '2026-03-10', description: 'A', amount: 10000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '8', workspace_id: 'ws-test-1', transaction_date: '2026-03-10', description: 'B', amount: 10000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '9', workspace_id: 'ws-test-1', transaction_date: '2026-03-10', description: 'C', amount: 10000, transaction_type: 'expense', category: 'Marketing', currency: 'USD', source: 'manual', status: 'completed' },

        // In anchor month M0 (2026-04): 90% spend in Cloud ($90k Cloud, $10k Payroll)
        { id: '10', workspace_id: 'ws-test-1', transaction_date: '2026-04-05', description: 'Huge Cloud', amount: 90000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '11', workspace_id: 'ws-test-1', transaction_date: '2026-04-05', description: 'Payroll', amount: 10000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
      ];

      // Health Score Factor 3 (Concentration across M-3..M-1): CS_max = 33% <= 40% -> scores 20/20!
      const health = calculateFinancialHealth(txs, 1000000);
      const concentrationFactor = health.factors.find((f) => f.name === 'Expense Concentration');
      expect(concentrationFactor?.score).toBe(20);

      // Attention Rule in M0: Cloud is 90% (> 60%) -> triggers ATTN_CONCENTRATION
      const alerts = evaluateAttentionItems(txs, testWorkspace);
      const concAlert = alerts.find((a) => a.ruleId === 'ATTN_CONCENTRATION');
      expect(concAlert).toBeDefined();
      expect(concAlert?.affectedCategory).toBe('Cloud');
    });
  });

  // 6. Cash Calculation Window vs Rate Windows
  describe('6. Cash Calculation Window vs Rate Windows', () => {
    it('uses complete inception history for cash on hand, while burn uses trailing completed months', () => {
      const txs: Transaction[] = [
        // Inception transaction 6 months ago (2025-10)
        { id: 'old-1', workspace_id: 'ws-test-1', transaction_date: '2025-10-15', description: 'Early Angel Wire', amount: 500000, transaction_type: 'income', category: 'Funding', currency: 'USD', source: 'manual', status: 'completed' },
        // Trailing months: 2026-01, 2026-02, 2026-03 ($10k/mo spend)
        { id: 't1', workspace_id: 'ws-test-1', transaction_date: '2026-01-10', description: 'Exp', amount: 10000, transaction_type: 'expense', category: 'OpEx', currency: 'USD', source: 'manual', status: 'completed' },
        { id: 't2', workspace_id: 'ws-test-1', transaction_date: '2026-02-10', description: 'Exp', amount: 10000, transaction_type: 'expense', category: 'OpEx', currency: 'USD', source: 'manual', status: 'completed' },
        { id: 't3', workspace_id: 'ws-test-1', transaction_date: '2026-03-10', description: 'Exp', amount: 10000, transaction_type: 'expense', category: 'OpEx', currency: 'USD', source: 'manual', status: 'completed' },
        // Anchor M0: 2026-04
        { id: 't4', workspace_id: 'ws-test-1', transaction_date: '2026-04-01', description: 'Exp', amount: 5000, transaction_type: 'expense', category: 'OpEx', currency: 'USD', source: 'manual', status: 'completed' },
      ];

      // Cash includes 2025-10 angel wire: $1,000,000 baseline + $500,000 - $35,000 = $1,465,000
      const cash = calculateCashOnHand(txs, 1000000);
      expect(cash).toBe(1465000);

      // Average monthly net burn uses only trailing completed months 2026-01..2026-03: $10,000/mo
      const netBurn = calculateMonthlyNetBurn(txs, 3);
      expect(netBurn).toBe(10000);
    });
  });

  // 7. MoM Revenue Growth State Machine
  describe('7. MoM Revenue Growth State Machine', () => {
    it('handles 0 transactions, 1 month, pre-revenue, first revenue, lost revenue, and valid growth', () => {
      // 0 transactions
      expect(calculateMoMGrowth([])).toEqual({
        momGrowthPercent: null,
        status: 'insufficient_data',
        burnChangePercent: 0,
        cashChangePercent: 0,
        cashChangeDisplay: 'No data',
        burnChangeDisplay: 'No data',
      });

      // 1 completed month only (M-1 = 2026-01, M0 = 2026-02) -> k = 1 < 2
      const singleCompletedMonthTxs: Transaction[] = [
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-15', description: 'R', amount: 10000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws', transaction_date: '2026-02-05', description: 'R', amount: 12000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      expect(calculateMoMGrowth(singleCompletedMonthTxs).status).toBe('insufficient_data');

      // 2 completed months with $0 revenue -> pre_revenue
      const preRevTxs: Transaction[] = [
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-15', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws', transaction_date: '2026-02-15', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws', transaction_date: '2026-03-05', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      expect(calculateMoMGrowth(preRevTxs).status).toBe('pre_revenue');

      // First revenue month (M-2 = 0, M-1 = 10000, M0 = anchor) -> first_revenue_period
      const firstRevTxs: Transaction[] = [
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-15', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws', transaction_date: '2026-02-15', description: 'R', amount: 10000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws', transaction_date: '2026-03-05', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      expect(calculateMoMGrowth(firstRevTxs).status).toBe('first_revenue_period');

      // Lost revenue (M-2 = 10000, M-1 = 0, M0 = anchor) -> -100%
      const lostRevTxs: Transaction[] = [
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-15', description: 'R', amount: 10000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws', transaction_date: '2026-02-15', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws', transaction_date: '2026-03-05', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      const lostRevResult = calculateMoMGrowth(lostRevTxs);
      expect(lostRevResult.status).toBe('active');
      expect(lostRevResult.momGrowthPercent).toBe(-100.0);

      // Normal positive growth (M-2 = 10000, M-1 = 15000, M0 = anchor) -> +50.0%
      const validGrowthTxs: Transaction[] = [
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-15', description: 'R', amount: 10000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws', transaction_date: '2026-02-15', description: 'R', amount: 15000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws', transaction_date: '2026-03-05', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      const growthResult = calculateMoMGrowth(validGrowthTxs);
      expect(growthResult.status).toBe('active');
      expect(growthResult.momGrowthPercent).toBe(50.0);
    });
  });

  // 8. Forecast k = 0 vs Zero-Burn Tests
  describe('8. Forecast k = 0 vs Zero-Burn Tests', () => {
    it('returns insufficient_data and generates 0 forecast points when k = 0', () => {
      // Single transaction in M0 only
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws', transaction_date: '2026-04-10', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      const projection = generateCashFlowProjection(txs, 500000);
      expect(projection.status).toBe('insufficient_data');
      expect(projection.hasSufficientData).toBe(false);
      // Only 1 boundary point in points, 0 forecast points!
      const forecastPoints = projection.points.filter((p) => p.isForecast);
      expect(forecastPoints.length).toBe(0);
    });

    it('generates a valid flat forecast when k >= 1 and average net burn is 0', () => {
      // Completed month with $10k income, $5k expense (net deficit = 0), M0 in next month
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-15', description: 'R', amount: 10000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws', transaction_date: '2026-01-20', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws', transaction_date: '2026-02-05', description: 'E', amount: 1000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      const projection = generateCashFlowProjection(txs, 500000);
      expect(projection.status).toBe('active');
      expect(projection.hasSufficientData).toBe(true);

      const forecastPoints = projection.points.filter((p) => p.isForecast);
      expect(forecastPoints.length).toBe(6);
      // Cash on hand: 500,000 + 10,000 - 6,000 = 504,000
      for (const p of forecastPoints) {
        expect(p.forecast).toBe(504000);
        expect(p.upperBand).toBe(504000);
        expect(p.lowerBand).toBe(504000);
      }
    });

    it('generates a downward forecast with +/- 10% uncertainty envelope when net burn > 0', () => {
      // Completed month with $10k expense, $0 income (net burn = $10k/mo), M0 in next month
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws', transaction_date: '2026-01-15', description: 'E', amount: 10000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws', transaction_date: '2026-02-05', description: 'E', amount: 1000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      // Starting cash 100,000 -> current cash = 89,000
      const projection = generateCashFlowProjection(txs, 100000);
      expect(projection.status).toBe('active');

      const forecastPoints = projection.points.filter((p) => p.isForecast);
      expect(forecastPoints.length).toBe(6);

      // Month 1 forecast: 89,000 - 10,000 = 79,000
      expect(forecastPoints[0].forecast).toBe(79000);
      // Upper bound (burn * 0.9 = 9,000): 89,000 - 9,000 = 80,000
      expect(forecastPoints[0].upperBand).toBe(80000);
      // Lower bound (burn * 1.1 = 11,000): 89,000 - 11,000 = 78,000
      expect(forecastPoints[0].lowerBand).toBe(78000);
    });
  });

  // 9. Attention Rule Triggers & Deduplication
  describe('9. Attention Rule Triggers & Thresholds', () => {
    it('triggers runway warning strictly below threshold, and runway critical below critical threshold', () => {
      // Completed month burn = $50,000/mo. M0 in 2026-02.
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws-test-1', transaction_date: '2026-01-15', description: 'E', amount: 50000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws-test-1', transaction_date: '2026-02-05', description: 'E', amount: 1000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];

      // Case A: Starting cash 295,000 -> cash = 244,000 -> runway = 244,000 / 50,000 = 4.88 mos (< 6.0 mos threshold)
      const warningAlerts = evaluateAttentionItems(txs, { ...testWorkspace, starting_cash: 295000 });
      const runwayWarn = warningAlerts.find((a) => a.ruleId === 'ATTN_RUNWAY_WARNING');
      expect(runwayWarn).toBeDefined();
      expect(runwayWarn?.severity).toBe('warning');

      // Case B: Starting cash 145,000 -> cash = 94,000 -> runway = 94,000 / 50,000 = 1.88 mos (< 3.0 mos critical)
      const criticalAlerts = evaluateAttentionItems(txs, { ...testWorkspace, starting_cash: 145000 });
      const runwayCrit = criticalAlerts.find((a) => a.ruleId === 'ATTN_RUNWAY_CRITICAL');
      expect(runwayCrit).toBeDefined();
      expect(runwayCrit?.severity).toBe('critical');
    });

    it('triggers expense spike strictly above 30% and delta >= 2000', () => {
      // Completed month M-1: $10,000 spend in Cloud
      // M0: $13,500 spend in Cloud (+35%, delta = $3,500 >= $2,000)
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws-test-1', transaction_date: '2026-01-15', description: 'E', amount: 10000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws-test-1', transaction_date: '2026-02-05', description: 'E', amount: 13500, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      const alerts = evaluateAttentionItems(txs, testWorkspace);
      const spike = alerts.find((a) => a.ruleId === 'ATTN_EXPENSE_SPIKE');
      expect(spike).toBeDefined();
      expect(spike?.affectedCategory).toBe('Cloud');
    });

    it('does not trigger expense spike if prior baseline is 0', () => {
      // Completed month M-1: $0 in Marketing
      // M0: $5,000 in Marketing (first time) -> no percentage spike alert!
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws-test-1', transaction_date: '2026-01-15', description: 'E', amount: 10000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws-test-1', transaction_date: '2026-02-05', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Marketing', currency: 'USD', source: 'manual', status: 'completed' },
      ];
      const alerts = evaluateAttentionItems(txs, testWorkspace);
      const mktSpike = alerts.find((a) => a.ruleId === 'ATTN_EXPENSE_SPIKE' && a.affectedCategory === 'Marketing');
      expect(mktSpike).toBeUndefined();
    });
  });

  // 10. Metric Explanations
  describe('10. Metric Explanations Generator', () => {
    it('generates step-by-step arithmetic explanations for all 4 core metrics', () => {
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws-test-1', transaction_date: '2026-01-15', description: 'R', amount: 50000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws-test-1', transaction_date: '2026-01-20', description: 'E', amount: 20000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws-test-1', transaction_date: '2026-02-10', description: 'E', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];

      const cashExplain = getMetricExplanation('cash', txs, testWorkspace);
      expect(cashExplain.formulaSteps.length).toBeGreaterThan(0);
      expect(cashExplain.title).toBe('Cash on Hand');

      const burnExplain = getMetricExplanation('burn', txs, testWorkspace);
      expect(burnExplain.formulaSteps.length).toBeGreaterThan(0);
      expect(burnExplain.burnMethodology).toContain('Trailing Average');

      const runwayExplain = getMetricExplanation('runway', txs, testWorkspace);
      expect(runwayExplain.formulaSteps.length).toBeGreaterThan(0);
      expect(runwayExplain.title).toBe('Estimated Runway');

      const growthExplain = getMetricExplanation('growth', txs, testWorkspace);
      expect(growthExplain.formulaSteps.length).toBeGreaterThan(0);
      expect(growthExplain.title).toBe('MoM Revenue Growth');
    });
  });

  // 11. Strict Mathematical Determinism Test
  describe('11. Strict Mathematical Determinism', () => {
    it('produces identical output when executed twice on identical input', () => {
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws-test-1', transaction_date: '2026-01-10', description: 'R1', amount: 25000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws-test-1', transaction_date: '2026-01-15', description: 'E1', amount: 15000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws-test-1', transaction_date: '2026-02-10', description: 'R2', amount: 30000, transaction_type: 'income', category: 'Rev', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '4', workspace_id: 'ws-test-1', transaction_date: '2026-02-15', description: 'E2', amount: 18000, transaction_type: 'expense', category: 'Payroll', currency: 'USD', source: 'manual', status: 'completed' },
        { id: '5', workspace_id: 'ws-test-1', transaction_date: '2026-03-05', description: 'E3', amount: 5000, transaction_type: 'expense', category: 'Cloud', currency: 'USD', source: 'manual', status: 'completed' },
      ];

      const kpi1 = calculateAllKPIs(txs, 500000);
      const kpi2 = calculateAllKPIs(txs, 500000);
      expect(kpi1).toEqual(kpi2);

      const health1 = calculateFinancialHealth(txs, 500000);
      const health2 = calculateFinancialHealth(txs, 500000);
      expect(health1).toEqual(health2);

      const alerts1 = evaluateAttentionItems(txs, testWorkspace);
      const alerts2 = evaluateAttentionItems(txs, testWorkspace);
      expect(alerts1).toEqual(alerts2);

      const proj1 = generateCashFlowProjection(txs, 500000);
      const proj2 = generateCashFlowProjection(txs, 500000);
      expect(proj1).toEqual(proj2);
    });
  });

  // 12. Database Status Compatibility & Dynamic Currency Presentation
  describe('12. Database Status Compatibility & Dynamic Currency Presentation', () => {
    it('decodes authoritative statuses from database column when present', () => {
      const dbTxCompleted = {
        id: 'tx-1',
        workspace_id: 'ws-1',
        transaction_date: '2026-03-01',
        amount: 1000,
        transaction_type: 'expense',
        status: 'completed',
        account_name: 'Operating Account',
      } as unknown as DatabaseTransaction;
      const dbTxFailed = {
        id: 'tx-2',
        workspace_id: 'ws-1',
        transaction_date: '2026-03-02',
        amount: 500,
        transaction_type: 'expense',
        status: 'failed',
        account_name: 'Operating Account',
      } as unknown as DatabaseTransaction;
      const dbTxPending = {
        id: 'tx-3',
        workspace_id: 'ws-1',
        transaction_date: '2026-03-03',
        amount: 750,
        transaction_type: 'income',
        status: 'pending',
        account_name: 'Operating Account',
      } as unknown as DatabaseTransaction;
      const dbTxReconciled = {
        id: 'tx-4',
        workspace_id: 'ws-1',
        transaction_date: '2026-03-04',
        amount: 300,
        transaction_type: 'expense',
        status: 'reconciled',
        account_name: 'Operating Account',
      } as unknown as DatabaseTransaction;

      expect(mapDatabaseTransaction(dbTxCompleted).status).toBe('completed');
      expect(mapDatabaseTransaction(dbTxFailed).status).toBe('failed');
      expect(mapDatabaseTransaction(dbTxPending).status).toBe('pending');
      expect(mapDatabaseTransaction(dbTxReconciled).status).toBe('reconciled');
    });

    it('decodes status from account_name fallback when status column is missing in schema', () => {
      const dbTxMissingColFailed = {
        id: 'tx-10',
        workspace_id: 'ws-1',
        transaction_date: '2026-03-01',
        amount: 2500,
        transaction_type: 'expense',
        account_name: 'Operating Account [status:failed]',
      } as unknown as DatabaseTransaction;
      const mapped = mapDatabaseTransaction(dbTxMissingColFailed);
      expect(mapped.status).toBe('failed');
      expect(mapped.external_reference).toBe('Operating Account');

      const dbTxCustomRefPending = {
        id: 'tx-11',
        workspace_id: 'ws-1',
        transaction_date: '2026-03-02',
        amount: 1500,
        transaction_type: 'income',
        account_name: 'STRIPE-PAYOUT-9021 [status:pending]',
      } as unknown as DatabaseTransaction;
      const mappedCustom = mapDatabaseTransaction(dbTxCustomRefPending);
      expect(mappedCustom.status).toBe('pending');
      expect(mappedCustom.external_reference).toBe('STRIPE-PAYOUT-9021');

      const dbTxReconciledFallback = {
        id: 'tx-12',
        workspace_id: 'ws-1',
        transaction_date: '2026-03-03',
        amount: 800,
        transaction_type: 'expense',
        account_name: 'Wire Transfer [status:reconciled]',
      } as unknown as DatabaseTransaction;
      const mappedReconciled = mapDatabaseTransaction(dbTxReconciledFallback);
      expect(mappedReconciled.status).toBe('reconciled');
      expect(mappedReconciled.external_reference).toBe('Wire Transfer');

      // Default when no status column and no fallback tag
      const dbTxNormal = {
        id: 'tx-13',
        workspace_id: 'ws-1',
        transaction_date: '2026-03-04',
        amount: 400,
        transaction_type: 'expense',
        account_name: 'Silicon Valley Bank',
      } as unknown as DatabaseTransaction;
      const mappedNormal = mapDatabaseTransaction(dbTxNormal);
      expect(mappedNormal.status).toBe('completed');
      expect(mappedNormal.external_reference).toBe('Silicon Valley Bank');
    });

    it('strictly excludes failed transactions from all calculations while including active ones', () => {
      const activeExpense: Transaction = {
        id: '1', workspace_id: 'ws-1', transaction_date: '2026-01-10',
        description: 'Server Ops', amount: 10000, transaction_type: 'expense', category: 'Software',
        currency: 'INR', source: 'manual', status: 'completed',
      };
      const pendingExpense: Transaction = {
        id: '2', workspace_id: 'ws-1', transaction_date: '2026-02-12',
        description: 'Pending License', amount: 5000, transaction_type: 'expense', category: 'Software',
        currency: 'INR', source: 'manual', status: 'pending',
      };
      const reconciledIncome: Transaction = {
        id: '3', workspace_id: 'ws-1', transaction_date: '2026-03-15',
        description: 'Client Invoice', amount: 20000, transaction_type: 'income', category: 'Revenue',
        currency: 'INR', source: 'manual', status: 'reconciled',
      };
      const failedExpense: Transaction = {
        id: '4', workspace_id: 'ws-1', transaction_date: '2026-01-20',
        description: 'Declined Wire', amount: 999999, transaction_type: 'expense', category: 'Fraud',
        currency: 'INR', source: 'manual', status: 'failed',
      };

      const allTxs = [activeExpense, pendingExpense, reconciledIncome, failedExpense];
      const startingCash = 50000;

      // Cash on hand: 50000 - 10000 - 5000 + 20000 = 55000. Failed (999999) must be ignored.
      const cash = calculateCashOnHand(allTxs, startingCash);
      expect(cash).toBe(55000);

      // Monthly Net Burn across completed months Jan & Feb: (10000 + 5000) / 2 = 7500.
      // If failed was included, burn would exceed 500K.
      const burn = calculateMonthlyNetBurn(allTxs);
      expect(burn).toBe(7500);

      // Financial health score calculation must succeed with sufficient data and ignore failed transaction
      const health = calculateFinancialHealth(allTxs, startingCash);
      expect(health.score).not.toBeNull();
      expect(health.hasSufficientData).toBe(true);
    });

    it('formats currency correctly across INR, USD, EUR, and GBP', () => {
      expect(getCurrencySymbol('INR')).toBe('₹');
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('GBP')).toBe('£');

      expect(formatCurrency(13000, 'INR')).toBe('₹13K');
      expect(formatCurrency(500000, 'INR')).toBe('₹500K');
      expect(formatCurrency(1500000, 'INR')).toBe('₹1.50M');
      expect(formatCurrency(250.75, 'INR')).toBe('₹250.75');

      expect(formatCurrency(13000, 'USD')).toBe('$13K');
    });

    it('reflects workspace currency dynamically in projection methodology', () => {
      const txs: Transaction[] = [
        { id: '1', workspace_id: 'ws-1', transaction_date: '2026-01-10', description: 'Ops 1', amount: 13000, transaction_type: 'expense', category: 'Ops', currency: 'INR', source: 'manual', status: 'completed' },
        { id: '2', workspace_id: 'ws-1', transaction_date: '2026-02-10', description: 'Ops 2', amount: 13000, transaction_type: 'expense', category: 'Ops', currency: 'INR', source: 'manual', status: 'completed' },
        { id: '3', workspace_id: 'ws-1', transaction_date: '2026-03-10', description: 'Ops 3', amount: 13000, transaction_type: 'expense', category: 'Ops', currency: 'INR', source: 'manual', status: 'completed' },
        { id: '4', workspace_id: 'ws-1', transaction_date: '2026-04-10', description: 'Ops 4', amount: 13000, transaction_type: 'expense', category: 'Ops', currency: 'INR', source: 'manual', status: 'completed' },
      ];

      const projectionINR = generateCashFlowProjection(txs, 100000, 6, 'INR');
      expect(projectionINR.forecastMethodology).toContain('₹13K/mo');
      expect(projectionINR.forecastMethodology).not.toContain('$13K/mo');

      const inrWorkspace: Workspace = {
        ...testWorkspace,
        currency: 'INR',
      };
      const burnExplanation = getMetricExplanation('burn', txs, inrWorkspace);
      expect(burnExplanation.currentDisplay).toContain('₹');
      expect(burnExplanation.currentDisplay).not.toContain('$');

      // Zero-cash financial health factor description formatting
      const zeroCashHealth = calculateFinancialHealth(txs, 0, 'INR');
      const runwayFactor = zeroCashHealth.factors.find((f) => f.name === 'Runway Buffer');
      expect(runwayFactor?.metricValue).toContain('₹0 cash');
      expect(runwayFactor?.metricValue).not.toContain('$0 cash');

      // What-if scenario assumptions formatting
      const whatIfINR = calculateWhatIfScenario(1000000, 50000, 10000, 0, 'Hiring 2', 'INR');
      for (const assumption of whatIfINR.assumptions) {
        expect(assumption).not.toContain('$');
      }
      expect(whatIfINR.assumptions[1]).toContain('₹1.00M');
      expect(whatIfINR.assumptions[2]).toContain('₹50K');

      // Attention items formatting for INR workspace
      const attentionItemsINR = evaluateAttentionItems(txs, inrWorkspace);
      for (const item of attentionItemsINR) {
        expect(item.supportingMetric).not.toContain('$');
        expect(item.detectedIssue).not.toContain('$');
      }

      // Recent Ledger Activity amount formatting strictly using active workspace currency
      const formatLedgerAmount = (amount: number, isIncome: boolean, workspaceCurrency?: string) =>
        `${isIncome ? '+' : '-'}${formatCurrency(Math.abs(amount), workspaceCurrency)}`;

      // INR workspace
      expect(formatLedgerAmount(20000, false, 'INR')).toBe('-₹20K');
      expect(formatLedgerAmount(100000, true, 'INR')).toBe('+₹100K');
      expect(formatLedgerAmount(30000, false, 'INR')).toBe('-₹30K');
      expect(formatLedgerAmount(10000, false, 'INR')).toBe('-₹10K');

      // USD workspace
      expect(formatLedgerAmount(20000, false, 'USD')).toBe('-$20K');
      expect(formatLedgerAmount(100000, true, 'USD')).toBe('+$100K');

      // EUR workspace
      expect(formatLedgerAmount(20000, false, 'EUR')).toBe('-€20K');
      expect(formatLedgerAmount(100000, true, 'EUR')).toBe('+€100K');

      // GBP workspace
      expect(formatLedgerAmount(20000, false, 'GBP')).toBe('-£20K');
      expect(formatLedgerAmount(100000, true, 'GBP')).toBe('+£100K');
    });
  });
});
