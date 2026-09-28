/**
 * Unified Financial Context Builder for FundFlow AI
 * Synthesizes 100% verified, deterministic financial figures directly from ledger data.
 * Zero Large Language Model calculation — authoritative metrics are calculated in TypeScript.
 */

import { Transaction, Workspace, AttentionItem, MetricExplanation, AICitation } from '@/types/finance';
import {
  calculateCashOnHand,
  calculateNetMonthlyBurn,
  calculateRunway,
  calculateCategoryBreakdown,
  calculateMoMGrowth,
  formatCurrency,
} from '@/lib/finance/calculator';
import { getReportingAnchorAndCompletedMonths } from '@/lib/finance/financial-health';
import { evaluateAttentionItems } from '@/lib/finance/attention-detector';
import { getMetricExplanation } from '@/lib/finance/metric-explanations';

const BASELINE_STARTING_CASH = 1240000;

export interface CategoryComparison {
  category: string;
  priorAmount: number;
  currentAmount: number;
  delta: number;
  growthPercent: number | null;
}

export interface StructuredFinancialContext {
  workspace: {
    id: string;
    name: string;
    currency: string;
  };
  cash: {
    current: number;
    formatted: string;
    startingBalance: number;
    netInceptionFlow: number;
  };
  burn: {
    monthlyNetBurn: number;
    formatted: string;
    methodology: string;
    isCashFlowPositive: boolean;
  };
  runway: {
    months: number;
    display: string;
    isInfinite: boolean;
    hasSufficientData: boolean;
    status: 'critical' | 'warning' | 'nominal' | 'profitable';
  };
  revenue: {
    totalRecorded: number;
    formatted: string;
    completedMonthsTotal: number;
  };
  growth: {
    momGrowthPercent: number | null;
    status: 'active' | 'insufficient_data' | 'pre_revenue' | 'first_revenue_period';
    formatted: string;
  };
  categories: {
    breakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
      transactionCount: number;
    }>;
    highestCategory: {
      category: string;
      amount: number;
      percentage: number;
    } | null;
    fastestGrowingCategory: CategoryComparison | null;
    categoryComparisons: CategoryComparison[];
  };
  transactions: {
    totalCount: number;
    activeCount: number;
    largestOutflows: Array<{
      id: string;
      description: string;
      merchant?: string | null;
      amount: number;
      category: string;
      date: string;
    }>;
    largestInflows: Array<{
      id: string;
      description: string;
      merchant?: string | null;
      amount: number;
      category: string;
      date: string;
    }>;
  };
  trends: {
    anchorMonth: string | null;
    completedMonths: string[];
    burnChange: {
      didIncrease: boolean;
      burnDelta: number;
      burnDeltaPercent: number | null;
      primaryCategoryDrivers: Array<{ category: string; delta: number; current: number; prior: number }>;
    };
    unusualSpending: AttentionItem[];
  };
  metricExplanations: {
    runwayExplanation: MetricExplanation;
    burnExplanation: MetricExplanation;
    cashExplanation: MetricExplanation;
    growthExplanation: MetricExplanation;
  };
  citations: AICitation[];
}

/**
 * Build authoritative, verified financial context for the AI Co-Pilot
 */
export function buildStructuredFinancialContext(
  workspace: Workspace,
  transactions: Transaction[],
  startingCash?: number
): StructuredFinancialContext {
  const currency = workspace?.currency || 'USD';
  const effectiveStartingCash = typeof startingCash === 'number'
    ? startingCash
    : typeof workspace?.starting_cash === 'number'
      ? workspace.starting_cash
      : BASELINE_STARTING_CASH;

  const effectiveWorkspace: Workspace = {
    ...workspace,
    starting_cash: effectiveStartingCash,
    currency,
  };

  // 1. Core KPIs
  const cashOnHand = calculateCashOnHand(transactions, effectiveStartingCash);
  const monthlyNetBurn = calculateNetMonthlyBurn(transactions);
  const runway = calculateRunway(cashOnHand, monthlyNetBurn);
  const categoryBreakdown = calculateCategoryBreakdown(transactions);
  const momGrowth = calculateMoMGrowth(transactions);

  // 2. Clock-independent Calendar Architecture
  const { reportingAnchorMonth, completedMonths } = getReportingAnchorAndCompletedMonths(transactions);
  const anchorMonth = reportingAnchorMonth || null;
  const hasCompletedMonths = completedMonths.length > 0;

  // Total Revenue & Net Flow
  const activeTx = transactions.filter((t) => t.status !== 'failed');
  const totalRevenue = activeTx
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = activeTx
    .filter((t) => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netInceptionFlow = totalRevenue - totalExpenses;

  // Revenue in completed window
  const completedTx = activeTx.filter((t) => {
    const ym = t.transaction_date.substring(0, 7);
    return completedMonths.includes(ym);
  });
  const completedMonthsRevenue = completedTx
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  // 3. Category Comparisons & Fastest Growing Category
  const categoryComparisons: CategoryComparison[] = [];
  let fastestGrowingCategory: CategoryComparison | null = null;

  if (completedMonths.length >= 2) {
    const latestCompleted = completedMonths[0]; // M-1
    const priorCompleted = completedMonths[1];  // M-2

    const catSpendLatest: Record<string, number> = {};
    const catSpendPrior: Record<string, number> = {};

    for (const t of activeTx) {
      if (t.transaction_type !== 'expense') continue;
      const ym = t.transaction_date.substring(0, 7);
      const cat = t.category || 'Uncategorized';
      if (ym === latestCompleted) {
        catSpendLatest[cat] = (catSpendLatest[cat] || 0) + t.amount;
      } else if (ym === priorCompleted) {
        catSpendPrior[cat] = (catSpendPrior[cat] || 0) + t.amount;
      }
    }

    const allCategories = Array.from(new Set([...Object.keys(catSpendLatest), ...Object.keys(catSpendPrior)]));
    let maxGrowthRate = -Infinity;

    for (const cat of allCategories) {
      const cur = catSpendLatest[cat] || 0;
      const prev = catSpendPrior[cat] || 0;
      const delta = cur - prev;
      let growthPercent: number | null = null;

      if (prev > 0) {
        growthPercent = Math.round(((cur - prev) / prev) * 1000) / 10;
        if (growthPercent > maxGrowthRate && cur > 500) {
          maxGrowthRate = growthPercent;
          fastestGrowingCategory = { category: cat, priorAmount: prev, currentAmount: cur, delta, growthPercent };
        }
      }

      categoryComparisons.push({
        category: cat,
        priorAmount: prev,
        currentAmount: cur,
        delta,
        growthPercent,
      });
    }

    categoryComparisons.sort((a, b) => b.delta - a.delta);
  }

  // 4. Burn Increase Analysis (M0 vs Trailing Completed Average or M-1)
  const currentMonthExpenses = anchorMonth
    ? activeTx
        .filter((t) => t.transaction_type === 'expense' && t.transaction_date.substring(0, 7) === anchorMonth)
        .reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const currentMonthIncome = anchorMonth
    ? activeTx
        .filter((t) => t.transaction_type === 'income' && t.transaction_date.substring(0, 7) === anchorMonth)
        .reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const currentMonthDeficit = Math.max(0, currentMonthExpenses - currentMonthIncome);
  const burnDelta = currentMonthDeficit - monthlyNetBurn;
  const didIncrease = burnDelta > 0 && monthlyNetBurn > 0;
  const burnDeltaPercent = monthlyNetBurn > 0 ? Math.round((burnDelta / monthlyNetBurn) * 1000) / 10 : null;

  // Identify category drivers of burn increase
  const currentMonthCatSpend: Record<string, number> = {};
  if (anchorMonth) {
    for (const t of activeTx) {
      if (t.transaction_type !== 'expense' || t.transaction_date.substring(0, 7) !== anchorMonth) continue;
      const cat = t.category || 'Uncategorized';
      currentMonthCatSpend[cat] = (currentMonthCatSpend[cat] || 0) + t.amount;
    }
  }

  const primaryCategoryDrivers: Array<{ category: string; delta: number; current: number; prior: number }> = [];
  for (const [cat, curAmt] of Object.entries(currentMonthCatSpend)) {
    // compare against average completed spend in this category
    const priorCompletedSpend = completedMonths.length > 0
      ? completedTx
          .filter((t) => t.transaction_type === 'expense' && (t.category || 'Uncategorized') === cat)
          .reduce((sum, t) => sum + t.amount, 0) / completedMonths.length
      : 0;

    const delta = curAmt - priorCompletedSpend;
    if (delta > 0) {
      primaryCategoryDrivers.push({
        category: cat,
        delta: Math.round(delta),
        current: Math.round(curAmt),
        prior: Math.round(priorCompletedSpend),
      });
    }
  }
  primaryCategoryDrivers.sort((a, b) => b.delta - a.delta);

  // 5. Largest Outflows & Inflows
  const largestOutflows = activeTx
    .filter((t) => t.transaction_type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      description: t.description,
      merchant: t.merchant,
      amount: t.amount,
      category: t.category,
      date: t.transaction_date,
    }));

  const largestInflows = activeTx
    .filter((t) => t.transaction_type === 'income')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      description: t.description,
      merchant: t.merchant,
      amount: t.amount,
      category: t.category,
      date: t.transaction_date,
    }));

  // 6. Attention / Unusual Spending
  const attentionItems = evaluateAttentionItems(transactions, effectiveWorkspace);

  // 7. Deterministic Metric Explanations
  const runwayExplanation = getMetricExplanation('runway', transactions, effectiveWorkspace);
  const burnExplanation = getMetricExplanation('burn', transactions, effectiveWorkspace);
  const cashExplanation = getMetricExplanation('cash', transactions, effectiveWorkspace);
  const growthExplanation = getMetricExplanation('growth', transactions, effectiveWorkspace);

  // 8. Base Citations for Attribution
  const citations: AICitation[] = [
    {
      id: 'cite-cash',
      type: 'financial_snapshot',
      label: `Cash: ${formatCurrency(cashOnHand, currency)}`,
      amount: cashOnHand,
      details: `Starting cash (${formatCurrency(effectiveStartingCash, currency)}) + Net ledger flow (${formatCurrency(netInceptionFlow, currency)})`,
    },
    {
      id: 'cite-burn',
      type: 'financial_snapshot',
      label: `Net Burn: ${formatCurrency(monthlyNetBurn, currency)}/mo`,
      amount: monthlyNetBurn,
      details: hasCompletedMonths
        ? `Average net cash deficit across completed months: ${completedMonths.join(', ')}`
        : 'Awaiting completed month baseline',
    },
    {
      id: 'cite-runway',
      type: 'financial_snapshot',
      label: `Runway: ${runway.display}`,
      details: `${formatCurrency(cashOnHand, currency)} cash / ${formatCurrency(monthlyNetBurn, currency)} monthly net burn`,
    },
  ];

  const highestCat = categoryBreakdown[0]
    ? {
        category: categoryBreakdown[0].category,
        amount: categoryBreakdown[0].amount,
        percentage: categoryBreakdown[0].percentage,
      }
    : null;

  if (highestCat) {
    citations.push({
      id: 'cite-top-expense-category',
      type: 'category_breakdown',
      label: `Top Outflow: ${highestCat.category} (${highestCat.percentage}%)`,
      amount: highestCat.amount,
    });
  }

  // Runway status
  let runwayStatus: 'critical' | 'warning' | 'nominal' | 'profitable' = 'nominal';
  if (runway.isCashFlowPositive) runwayStatus = 'profitable';
  else if (runway.runwayMonths < 3) runwayStatus = 'critical';
  else if (runway.runwayMonths < 6) runwayStatus = 'warning';

  let growthFormatted = 'Insufficient data';
  if (momGrowth.status === 'active' && momGrowth.momGrowthPercent !== null) {
    growthFormatted = `${momGrowth.momGrowthPercent >= 0 ? '+' : ''}${momGrowth.momGrowthPercent.toFixed(1)}% MoM`;
  } else if (momGrowth.status === 'pre_revenue') {
    growthFormatted = 'Pre-revenue';
  } else if (momGrowth.status === 'first_revenue_period') {
    growthFormatted = 'First revenue recorded';
  }

  return {
    workspace: {
      id: workspace?.id || 'default-workspace',
      name: workspace?.name || 'Workspace',
      currency,
    },
    cash: {
      current: cashOnHand,
      formatted: formatCurrency(cashOnHand, currency),
      startingBalance: effectiveStartingCash,
      netInceptionFlow,
    },
    burn: {
      monthlyNetBurn,
      formatted: `${formatCurrency(monthlyNetBurn, currency)}/mo`,
      methodology: hasCompletedMonths
        ? `3-month completed rolling deficit (${completedMonths.join(', ')})`
        : 'Single-month initial baseline',
      isCashFlowPositive: runway.isCashFlowPositive,
    },
    runway: {
      months: runway.runwayMonths,
      display: runway.display,
      isInfinite: runway.isCashFlowPositive,
      hasSufficientData: hasCompletedMonths,
      status: runwayStatus,
    },
    revenue: {
      totalRecorded: totalRevenue,
      formatted: formatCurrency(totalRevenue, currency),
      completedMonthsTotal: completedMonthsRevenue,
    },
    growth: {
      momGrowthPercent: momGrowth.momGrowthPercent,
      status: momGrowth.status,
      formatted: growthFormatted,
    },
    categories: {
      breakdown: categoryBreakdown,
      highestCategory: highestCat,
      fastestGrowingCategory,
      categoryComparisons,
    },
    transactions: {
      totalCount: transactions.length,
      activeCount: activeTx.length,
      largestOutflows,
      largestInflows,
    },
    trends: {
      anchorMonth,
      completedMonths,
      burnChange: {
        didIncrease,
        burnDelta,
        burnDeltaPercent,
        primaryCategoryDrivers,
      },
      unusualSpending: attentionItems,
    },
    metricExplanations: {
      runwayExplanation,
      burnExplanation,
      cashExplanation,
      growthExplanation,
    },
    citations,
  };
}
