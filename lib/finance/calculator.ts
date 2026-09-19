import {
  Transaction,
  FinancialKPIs,
  ExpenseBreakdownItem,
  CashFlowProjection,
  ScenarioCalculationResult,
} from '@/types/finance';
import {
  getReportingAnchorAndCompletedMonths,
  getMonthlyTotalsMap,
} from './financial-health';
import { generateCashFlowProjection as generateProjectionEngine } from './projections';

const BASELINE_STARTING_CASH = 1240000; // $1.24M default baseline for startup demo

/**
 * Calculates current cash on hand based on starting balance + all recorded non-failed transactions.
 * Uses the full inception horizon.
 */
export function calculateCashOnHand(
  transactions: Transaction[],
  startingBalance?: number
): number {
  const effectiveBaseline = typeof startingBalance === 'number' ? startingBalance : BASELINE_STARTING_CASH;
  if (!transactions || transactions.length === 0) {
    return effectiveBaseline;
  }

  // Sum all income transactions and subtract all expense transactions for active (non-failed) rows
  const netFlow = transactions.reduce((acc, tx) => {
    if (tx.status === 'failed') return acc;
    if (tx.transaction_type === 'income') {
      return acc + Number(tx.amount);
    } else {
      return acc - Number(tx.amount);
    }
  }, 0);

  return Math.max(0, effectiveBaseline + netFlow);
}

/**
 * Calculates Average Monthly Outflow across preceding completed calendar months (up to monthsWindow).
 * Calendar gaps strictly count with $0 expense.
 */
export function calculateMonthlyGrossOutflow(
  transactions: Transaction[],
  monthsWindow: number = 3
): number {
  const activeTxs = (transactions || []).filter((t) => t.status !== 'failed');
  if (activeTxs.length === 0) return 0;

  const { completedMonths } = getReportingAnchorAndCompletedMonths(activeTxs);
  const { outflows } = getMonthlyTotalsMap(activeTxs);

  if (completedMonths.length === 0) {
    if (outflows.size === 0) return 0;
    const total = Array.from(outflows.values()).reduce((sum, v) => sum + v, 0);
    return Math.round(total / outflows.size);
  }

  const targetMonths = completedMonths.slice(0, Math.max(1, monthsWindow));

  let sum = 0;
  for (const m of targetMonths) {
    sum += outflows.get(m) || 0;
  }

  return Math.round(sum / targetMonths.length);
}

/**
 * Alias for calculateMonthlyGrossOutflow for backwards compatibility.
 */
export function calculateMonthlyBurn(
  transactions: Transaction[],
  monthsWindow: number = 3
): number {
  return calculateMonthlyGrossOutflow(transactions, monthsWindow);
}

/**
 * Calculates Average Monthly Net Burn across preceding completed calendar months.
 * Formula: NB_m = max(0, O_m - I_m); AverageNB = (Σ NB_m) / k.
 */
export function calculateMonthlyNetBurn(
  transactions: Transaction[],
  monthsWindow: number = 3
): number {
  const activeTxs = (transactions || []).filter((t) => t.status !== 'failed');
  if (activeTxs.length === 0) return 0;

  const { completedMonths } = getReportingAnchorAndCompletedMonths(activeTxs);
  if (completedMonths.length === 0) return 0;

  const { inflows, outflows } = getMonthlyTotalsMap(activeTxs);
  const targetMonths = completedMonths.slice(0, Math.max(1, monthsWindow));

  let totalDeficit = 0;
  for (const m of targetMonths) {
    const o = outflows.get(m) || 0;
    const i = inflows.get(m) || 0;
    totalDeficit += Math.max(0, o - i);
  }

  return Math.round(totalDeficit / targetMonths.length);
}

/**
 * Alias for calculateMonthlyNetBurn for backwards compatibility with existing AI retriever.
 */
export function calculateNetMonthlyBurn(transactions: Transaction[]): number {
  return calculateMonthlyNetBurn(transactions, 3);
}

/**
 * Calculates runway in months based on Cash on Hand and Average Monthly Net Burn.
 * Safely handles zero/negative burn and zero cash without fake infinite numbers.
 */
export function calculateRunway(
  cashOnHand: number,
  monthlyBurn: number
): { runwayMonths: number; display: string; isCashFlowPositive: boolean } {
  if (cashOnHand <= 0) {
    return { runwayMonths: 0, display: '0 Mos', isCashFlowPositive: false };
  }

  if (monthlyBurn <= 0) {
    return {
      runwayMonths: 999,
      display: 'Cash-Flow Positive',
      isCashFlowPositive: true,
    };
  }

  const runway = Math.round((cashOnHand / monthlyBurn) * 10) / 10;
  const displayMonths = runway % 1 === 0 ? `${runway} Mos` : `${runway.toFixed(1)} Mos`;

  return {
    runwayMonths: runway,
    display: displayMonths,
    isCashFlowPositive: false,
  };
}

/**
 * Calculates Month-over-Month Revenue Growth between the two most recently completed calendar months (M-1 vs M-2).
 * Returns strict typed status; zero fake numbers (no 12.4% fallback).
 */
export function calculateMoMGrowth(transactions: Transaction[]): {
  momGrowthPercent: number | null;
  status: 'active' | 'insufficient_data' | 'pre_revenue' | 'first_revenue_period';
  burnChangePercent: number;
  cashChangePercent: number;
  cashChangeDisplay?: string;
  burnChangeDisplay?: string;
} {
  const activeTxs = (transactions || []).filter((t) => t.status !== 'failed');
  if (activeTxs.length === 0) {
    return {
      momGrowthPercent: null,
      status: 'insufficient_data',
      burnChangePercent: 0,
      cashChangePercent: 0,
      cashChangeDisplay: 'No data',
      burnChangeDisplay: 'No data',
    };
  }

  const { completedMonths, k } = getReportingAnchorAndCompletedMonths(activeTxs);
  if (k < 2) {
    return {
      momGrowthPercent: null,
      status: 'insufficient_data',
      burnChangePercent: 0,
      cashChangePercent: 0,
      cashChangeDisplay: 'Requires 2 months',
      burnChangeDisplay: 'Requires 2 months',
    };
  }

  const { inflows, outflows } = getMonthlyTotalsMap(activeTxs);
  const m1 = completedMonths[0]; // M-1 (latest completed)
  const m2 = completedMonths[1]; // M-2 (prior completed)

  const rev1 = inflows.get(m1) || 0;
  const rev2 = inflows.get(m2) || 0;
  const exp1 = outflows.get(m1) || 0;
  const exp2 = outflows.get(m2) || 0;

  // MoM Burn Change
  let burnChangePercent = 0;
  let burnChangeDisplay = '0.0%';
  if (exp2 > 0) {
    burnChangePercent = Math.round(((exp1 - exp2) / exp2) * 1000) / 10;
    burnChangeDisplay = `${burnChangePercent >= 0 ? '+' : ''}${burnChangePercent.toFixed(1)}%`;
  } else if (exp1 > 0) {
    burnChangePercent = 100;
    burnChangeDisplay = '+100%';
  }

  // MoM Revenue Growth
  if (rev1 === 0 && rev2 === 0) {
    return {
      momGrowthPercent: null,
      status: 'pre_revenue',
      burnChangePercent,
      cashChangePercent: 0,
      cashChangeDisplay: 'N/A',
      burnChangeDisplay,
    };
  }

  if (rev2 === 0 && rev1 > 0) {
    return {
      momGrowthPercent: null,
      status: 'first_revenue_period',
      burnChangePercent,
      cashChangePercent: 0,
      cashChangeDisplay: 'First Revenue',
      burnChangeDisplay,
    };
  }

  if (rev2 > 0 && rev1 === 0) {
    return {
      momGrowthPercent: -100.0,
      status: 'active',
      burnChangePercent,
      cashChangePercent: 0,
      cashChangeDisplay: '-100%',
      burnChangeDisplay,
    };
  }

  const momGrowthPercent = Math.round(((rev1 - rev2) / rev2) * 1000) / 10;

  return {
    momGrowthPercent,
    status: 'active',
    burnChangePercent,
    cashChangePercent: momGrowthPercent,
    cashChangeDisplay: `${momGrowthPercent >= 0 ? '+' : ''}${momGrowthPercent.toFixed(1)}%`,
    burnChangeDisplay,
  };
}

/**
 * Calculates complete KPI object from workspace transactions
 */
export function calculateAllKPIs(
  transactions: Transaction[],
  startingBalance?: number
): FinancialKPIs {
  const activeTxs = (transactions || []).filter((t) => t.status !== 'failed');
  const cashOnHand = calculateCashOnHand(activeTxs, startingBalance);
  const monthlyNetBurn = calculateMonthlyNetBurn(activeTxs);
  const { runwayMonths, display, isCashFlowPositive } = calculateRunway(cashOnHand, monthlyNetBurn);
  const momResult = calculateMoMGrowth(activeTxs);
  const { reportingAnchorMonth, k } = getReportingAnchorAndCompletedMonths(activeTxs);

  const hasData = activeTxs.length > 0;

  return {
    cashOnHand,
    cashChangePercent: momResult.cashChangePercent,
    cashChangeDisplay: momResult.cashChangeDisplay,
    monthlyBurn: monthlyNetBurn,
    burnChangePercent: momResult.burnChangePercent,
    burnChangeDisplay: momResult.burnChangeDisplay,
    runwayMonths,
    runwayDisplay: display,
    momGrowthPercent: momResult.momGrowthPercent,
    momGrowthStatus: momResult.status,
    growthTargetPercent: 1.5,
    isCashFlowPositive,
    hasSufficientData: hasData,
    completedMonthsCount: k,
    reportingAnchorMonth,
  };
}

/**
 * Generates verified historical cumulative cash flow trajectory and deterministic forecast.
 */
export function generateCashFlowProjection(
  transactionsOrCashOnHand: Transaction[] | number,
  startingBalanceOrBurn?: number,
  forecastMonthsCount?: number,
  currency?: string
): CashFlowProjection {
  // If called with transactions array:
  if (Array.isArray(transactionsOrCashOnHand)) {
    return generateProjectionEngine(transactionsOrCashOnHand, startingBalanceOrBurn, forecastMonthsCount, currency);
  }

  // Backwards compatibility fallback if invoked with (cashOnHand, monthlyBurn):
  const cashOnHand = transactionsOrCashOnHand;
  const monthlyBurn = startingBalanceOrBurn || 0;
  const isCashFlowPositive = monthlyBurn <= 0;
  const { runwayMonths } = calculateRunway(cashOnHand, monthlyBurn);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const currentMonthIdx = now.getMonth();

  const points = [
    { month: `${monthNames[currentMonthIdx]} (Current)`, actual: Math.round(cashOnHand), isCurrent: true, isForecast: false },
    {
      month: monthNames[(currentMonthIdx + 1) % 12],
      forecast: isCashFlowPositive ? Math.round(cashOnHand) : Math.max(0, Math.round(cashOnHand - monthlyBurn)),
      isCurrent: false,
      isForecast: true,
    },
    {
      month: monthNames[(currentMonthIdx + 2) % 12],
      forecast: isCashFlowPositive ? Math.round(cashOnHand) : Math.max(0, Math.round(cashOnHand - monthlyBurn * 2)),
      isCurrent: false,
      isForecast: true,
    },
  ];

  return {
    points,
    currentCash: cashOnHand,
    projectedRunway: runwayMonths,
    monthlyNetBurn: monthlyBurn,
    status: 'active',
    forecastMethodology: 'Deterministic linear trajectory',
    hasSufficientData: true,
  };
}

/**
 * Calculates category-level expense distribution across active transactions.
 * Returns empty array if no expenses exist (never displays fake dummy categories).
 */
export function calculateCategoryBreakdown(
  transactions: Transaction[]
): ExpenseBreakdownItem[] {
  const expenseTx = (transactions || []).filter(
    (tx) => tx.transaction_type === 'expense' && tx.status !== 'failed'
  );

  if (expenseTx.length === 0) {
    return [];
  }

  const categoryMap = new Map<string, { amount: number; count: number }>();
  let totalExpense = 0;

  for (const tx of expenseTx) {
    const cat = tx.category || 'Other';
    const existing = categoryMap.get(cat) || { amount: 0, count: 0 };
    const amt = Number(tx.amount);
    categoryMap.set(cat, {
      amount: existing.amount + amt,
      count: existing.count + 1,
    });
    totalExpense += amt;
  }

  if (totalExpense === 0) totalExpense = 1;

  const colorPalette = [
    'bg-primary',
    'bg-primary-container',
    'bg-surface-tint',
    'bg-outline',
    'bg-secondary',
    'bg-on-tertiary-container',
  ];

  const sortedCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([category, { amount, count }], idx) => {
      const percentage = Math.max(1, Math.round((amount / totalExpense) * 100));
      return {
        category,
        amount: Math.round(amount),
        percentage,
        colorClass: colorPalette[idx % colorPalette.length],
        transactionCount: count,
      };
    });

  return sortedCategories;
}

/**
 * Deterministic What-If Scenario Calculation
 */
export function calculateWhatIfScenario(
  currentCash: number,
  currentMonthlyBurn: number,
  deltaMonthlyBurn: number,
  deltaMonthlyRevenue: number = 0,
  _scenarioName: string = 'Custom What-If',
  currency: string = 'USD'
): ScenarioCalculationResult {
  const effectiveCurrentBurn = Math.max(0, currentMonthlyBurn);
  const currentRunway = effectiveCurrentBurn > 0
    ? Math.round((currentCash / effectiveCurrentBurn) * 10) / 10
    : 999;

  const netMonthlyCostImpact = deltaMonthlyBurn - deltaMonthlyRevenue;
  const newMonthlyBurn = Math.max(0, effectiveCurrentBurn + netMonthlyCostImpact);
  const projectedRunway = newMonthlyBurn > 0
    ? Math.round((currentCash / newMonthlyBurn) * 10) / 10
    : 999;
  const differenceMonths = Math.round((projectedRunway - currentRunway) * 10) / 10;

  const sym = getCurrencySymbol(currency);
  const assumptions: string[] = [
    `Scenario Model: ${_scenarioName || 'Custom What-If'}.`,
    `Current cash position of ${sym}${(currentCash / 1000000).toFixed(2)}M remains constant.`,
    `Current monthly baseline burn is ${sym}${(currentMonthlyBurn / 1000).toFixed(0)}K.`,
    `New monthly incremental cost is ${sym}${(netMonthlyCostImpact / 1000).toFixed(0)}K.`,
    `Projected monthly burn becomes ${sym}${(newMonthlyBurn / 1000).toFixed(0)}K.`,
  ];

  return {
    currentCash,
    currentMonthlyBurn,
    currentRunway,
    newMonthlyBurn,
    projectedRunway,
    differenceMonths,
    monthlyCostImpact: netMonthlyCostImpact,
    assumptions,
  };
}

/**
 * Calculates total income across transactions (excluding failed status)
 */
export function calculateTotalInflow(transactions: Transaction[]): number {
  if (!transactions || transactions.length === 0) return 0;
  return transactions.reduce((acc, t) => {
    if (t.status === 'failed') return acc;
    return t.transaction_type === 'income' ? acc + Number(t.amount || 0) : acc;
  }, 0);
}

/**
 * Calculates total operating expenses across transactions (excluding failed status)
 */
export function calculateTotalOutflow(transactions: Transaction[]): number {
  if (!transactions || transactions.length === 0) return 0;
  return transactions.reduce((acc, t) => {
    if (t.status === 'failed') return acc;
    return t.transaction_type === 'expense' ? acc + Number(t.amount || 0) : acc;
  }, 0);
}

/**
 * Calculates net cash flow across all recorded transactions (Inflow - Outflow)
 */
export function calculateNetCashFlow(transactions: Transaction[]): number {
  return calculateTotalInflow(transactions) - calculateTotalOutflow(transactions);
}

/**
 * Calculates total expense volume from category breakdown items
 */
export function calculateTotalFromBreakdown(breakdown: ExpenseBreakdownItem[]): number {
  if (!breakdown || breakdown.length === 0) return 0;
  return breakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/**
 * Currency symbol mapping helper
 */
export function getCurrencySymbol(currency: string = 'USD'): string {
  const code = (currency || 'USD').toUpperCase().trim();
  switch (code) {
    case 'INR':
      return '₹';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'CAD':
      return 'CA$';
    case 'AUD':
      return 'AU$';
    case 'SGD':
      return 'SG$';
    case 'JPY':
      return '¥';
    case 'USD':
    default:
      return '$';
  }
}

/**
 * Currency formatter helper in JetBrains Mono style with multi-currency support
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const sym = getCurrencySymbol(currency);

  if (abs >= 1000000) {
    return `${sign}${sym}${(abs / 1000000).toFixed(2)}M`;
  }
  if (abs >= 10000) {
    return `${sign}${sym}${(abs / 1000).toFixed(0)}K`;
  }
  return `${sign}${sym}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
