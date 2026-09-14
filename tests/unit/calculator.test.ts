import { describe, it, expect } from 'vitest';
import {
  calculateCashOnHand,
  calculateMonthlyBurn,
  calculateRunway,
  calculateTotalInflow,
  calculateTotalOutflow,
  calculateNetCashFlow,
  calculateTotalFromBreakdown,
  calculateWhatIfScenario,
} from '../../lib/finance/calculator';
import { Transaction } from '../../types/finance';

const mockTransactions: Transaction[] = [
  {
    id: '1',
    workspace_id: 'ws-1',
    transaction_date: '2025-01-10',
    description: 'Customer Subscription',
    amount: 15000,
    transaction_type: 'income',
    category: 'Revenue',
    currency: 'USD',
    source: 'manual',
    status: 'completed',
    created_at: '2025-01-10T10:00:00Z',
    updated_at: '2025-01-10T10:00:00Z',
  },
  {
    id: '2',
    workspace_id: 'ws-1',
    transaction_date: '2025-01-12',
    description: 'AWS Cloud',
    amount: 5000,
    transaction_type: 'expense',
    category: 'Cloud Infrastructure',
    currency: 'USD',
    source: 'manual',
    status: 'completed',
    created_at: '2025-01-12T10:00:00Z',
    updated_at: '2025-01-12T10:00:00Z',
  },
  {
    id: '3',
    workspace_id: 'ws-1',
    transaction_date: '2025-01-15',
    description: 'Failed Vendor Charge',
    amount: 2000,
    transaction_type: 'expense',
    category: 'Software',
    currency: 'USD',
    source: 'manual',
    status: 'failed',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
];

describe('Financial Calculator Logic', () => {
  it('calculates total inflow ignoring failed transactions', () => {
    const inflow = calculateTotalInflow(mockTransactions);
    expect(inflow).toBe(15000);
  });

  it('calculates total outflow ignoring failed transactions', () => {
    const outflow = calculateTotalOutflow(mockTransactions);
    expect(outflow).toBe(5000);
  });

  it('calculates monthly burn correctly', () => {
    const burn = calculateMonthlyBurn(mockTransactions);
    expect(burn).toBe(5000);
  });

  it('calculates net cash flow correctly', () => {
    const net = calculateNetCashFlow(mockTransactions);
    expect(net).toBe(10000);
  });

  it('calculates cash on hand with custom starting balance', () => {
    const cash = calculateCashOnHand(mockTransactions, 100000);
    // 100000 + (15000 - 5000) = 110000
    expect(cash).toBe(110000);
  });

  it('calculates runway safely for positive burn', () => {
    const { runwayMonths, display, isCashFlowPositive } = calculateRunway(100000, 20000);
    expect(runwayMonths).toBe(5);
    expect(display).toBe('5 Mos');
    expect(isCashFlowPositive).toBe(false);
  });

  it('calculates runway safely for zero or negative burn', () => {
    const zeroBurn = calculateRunway(100000, 0);
    expect(zeroBurn.isCashFlowPositive).toBe(true);
    expect(zeroBurn.runwayMonths).toBe(999);

    const negBurn = calculateRunway(100000, -5000);
    expect(negBurn.isCashFlowPositive).toBe(true);
  });

  it('calculates runway safely for zero or negative cash on hand', () => {
    const zeroCash = calculateRunway(0, 20000);
    expect(zeroCash.runwayMonths).toBe(0);
    expect(zeroCash.display).toBe('0 Mos');
  });

  it('calculates total from category breakdown', () => {
    const breakdown = [
      { category: 'Cloud', amount: 5000, percentage: 50, colorClass: 'bg-primary', transactionCount: 1 },
      { category: 'Payroll', amount: 5000, percentage: 50, colorClass: 'bg-secondary', transactionCount: 1 },
    ];
    expect(calculateTotalFromBreakdown(breakdown)).toBe(10000);
  });

  it('calculates what-if scenario accurately without crashing', () => {
    const result = calculateWhatIfScenario(
      1200000, // currentCash
      80000,   // currentMonthlyBurn
      20000,   // deltaMonthlyBurn
      5000,    // deltaMonthlyRevenue
      'Hire 2 Engineers'
    );

    expect(result.newMonthlyBurn).toBe(95000);
    expect(result.projectedRunway).toBeGreaterThan(0);
    expect(result.differenceMonths).toBeDefined();
    expect(result.assumptions.length).toBeGreaterThan(0);
  });
});
