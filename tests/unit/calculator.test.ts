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
  getCurrencyName,
  getCurrencySymbol,
  formatCurrency,
  SUPPORTED_CURRENCIES,
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

  describe('Multi-Currency Formatting and Helpers', () => {
    it('provides all 8 supported currencies with code, symbol, and name', () => {
      const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
      expect(codes).toEqual(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'SGD', 'JPY']);
      expect(SUPPORTED_CURRENCIES.find((c) => c.code === 'INR')?.symbol).toBe('₹');
      expect(SUPPORTED_CURRENCIES.find((c) => c.code === 'EUR')?.symbol).toBe('€');
      expect(SUPPORTED_CURRENCIES.find((c) => c.code === 'GBP')?.symbol).toBe('£');
      expect(SUPPORTED_CURRENCIES.find((c) => c.code === 'USD')?.symbol).toBe('$');
    });

    it('resolves correct currency names for all supported currencies with USD fallback', () => {
      expect(getCurrencyName('INR')).toBe('Indian Rupee');
      expect(getCurrencyName('EUR')).toBe('Euro');
      expect(getCurrencyName('GBP')).toBe('British Pound');
      expect(getCurrencyName('USD')).toBe('United States Dollar');
      expect(getCurrencyName('CAD')).toBe('Canadian Dollar');
      expect(getCurrencyName('AUD')).toBe('Australian Dollar');
      expect(getCurrencyName('SGD')).toBe('Singapore Dollar');
      expect(getCurrencyName('JPY')).toBe('Japanese Yen');
      expect(getCurrencyName('UNKNOWN')).toBe('United States Dollar');
      expect(getCurrencyName(undefined)).toBe('United States Dollar');
    });

    it('resolves correct currency symbols for INR, EUR, GBP, USD, and others', () => {
      expect(getCurrencySymbol('INR')).toBe('₹');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('GBP')).toBe('£');
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('CAD')).toBe('CA$');
      expect(getCurrencySymbol('AUD')).toBe('AU$');
      expect(getCurrencySymbol('SGD')).toBe('SG$');
      expect(getCurrencySymbol('JPY')).toBe('¥');
      expect(getCurrencySymbol('UNKNOWN')).toBe('$');
      expect(getCurrencySymbol(undefined)).toBe('$');
    });

    it('formats monetary values respecting active currency and scale', () => {
      // Small amounts (formatted with commas and 2 decimals)
      expect(formatCurrency(1500, 'USD')).toBe('$1,500.00');
      expect(formatCurrency(1500, 'INR')).toBe('₹1,500.00');
      expect(formatCurrency(1500, 'EUR')).toBe('€1,500.00');
      expect(formatCurrency(1500, 'GBP')).toBe('£1,500.00');

      // Thousands (>= 10,000, formatted as K)
      expect(formatCurrency(50000, 'USD')).toBe('$50K');
      expect(formatCurrency(500000, 'INR')).toBe('₹500K');
      expect(formatCurrency(25000, 'EUR')).toBe('€25K');
      expect(formatCurrency(75000, 'GBP')).toBe('£75K');

      // Millions (>= 1,000,000, formatted as M)
      expect(formatCurrency(1200000, 'USD')).toBe('$1.20M');
      expect(formatCurrency(5000000, 'INR')).toBe('₹5.00M');
      expect(formatCurrency(2500000, 'EUR')).toBe('€2.50M');
      expect(formatCurrency(10000000, 'GBP')).toBe('£10.00M');

      // Negative values
      expect(formatCurrency(-5000, 'INR')).toBe('-₹5,000.00');
      expect(formatCurrency(-50000, 'EUR')).toBe('-€50K');
      expect(formatCurrency(-1500000, 'GBP')).toBe('-£1.50M');
    });
  });
});
