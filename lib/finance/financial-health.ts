import { Transaction, FinancialHealthScore, HealthCategory, HealthFactorContribution } from '@/types/finance';
import { calculateCashOnHand, getCurrencySymbol } from './calculator';

/**
 * Returns previous calendar month in YYYY-MM format.
 */
export function getPreviousMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Derives the reporting anchor month M0 and up to 3 completed calendar months M-1, M-2, M-3.
 * Calendar gaps strictly count as months contributing 0 net cash flow.
 */
export function getReportingAnchorAndCompletedMonths(transactions: Transaction[]): {
  reportingAnchorMonth: string | undefined;
  completedMonths: string[]; // [M-1, M-2, M-3] or fewer depending on ledger inception
  k: number;
} {
  const activeTxs = transactions.filter((t) => t.status !== 'failed');
  if (activeTxs.length === 0) {
    return { reportingAnchorMonth: undefined, completedMonths: [], k: 0 };
  }

  // Find latest transaction month (M0) and earliest transaction month
  let minMonth = activeTxs[0].transaction_date.substring(0, 7);
  let maxMonth = activeTxs[0].transaction_date.substring(0, 7);

  for (const t of activeTxs) {
    const m = t.transaction_date.substring(0, 7);
    if (m < minMonth) minMonth = m;
    if (m > maxMonth) maxMonth = m;
  }

  const reportingAnchorMonth = maxMonth;

  // Determine completed preceding calendar months up to 3
  const completedMonths: string[] = [];
  let curr = getPreviousMonthKey(reportingAnchorMonth);

  while (completedMonths.length < 3 && curr >= minMonth) {
    completedMonths.push(curr);
    curr = getPreviousMonthKey(curr);
  }

  return {
    reportingAnchorMonth,
    completedMonths,
    k: completedMonths.length,
  };
}

/**
 * Computes monthly inflow and outflow maps across active transactions.
 */
export function getMonthlyTotalsMap(transactions: Transaction[]): {
  inflows: Map<string, number>;
  outflows: Map<string, number>;
  categoryOutflows: Map<string, Map<string, number>>; // month -> category -> amount
} {
  const inflows = new Map<string, number>();
  const outflows = new Map<string, number>();
  const categoryOutflows = new Map<string, Map<string, number>>();

  for (const tx of transactions) {
    if (tx.status === 'failed') continue;
    const m = tx.transaction_date.substring(0, 7);
    const amt = Number(tx.amount);

    if (tx.transaction_type === 'income') {
      inflows.set(m, (inflows.get(m) || 0) + amt);
    } else {
      outflows.set(m, (outflows.get(m) || 0) + amt);

      let catMap = categoryOutflows.get(m);
      if (!catMap) {
        catMap = new Map<string, number>();
        categoryOutflows.set(m, catMap);
      }
      const cat = tx.category || 'Other';
      catMap.set(cat, (catMap.get(cat) || 0) + amt);
    }
  }

  return { inflows, outflows, categoryOutflows };
}

/**
 * Deterministic Financial Health Score heuristic (0-100)
 */
export function calculateFinancialHealth(
  transactions: Transaction[],
  startingBalance?: number,
  currency: string = 'USD'
): FinancialHealthScore {
  const { reportingAnchorMonth, completedMonths, k } = getReportingAnchorAndCompletedMonths(transactions);

  // Insufficient data when k = 0 or 0 transactions
  if (k === 0 || !reportingAnchorMonth) {
    return {
      score: null,
      maxScore: 100,
      category: 'Insufficient Data',
      factors: [
        {
          name: 'Runway Buffer',
          score: 0,
          maxScore: 40,
          weightPercent: 40,
          status: 'neutral',
          description: 'Requires at least 1 completed calendar month preceding anchor month to calculate runway burn basis.',
          metricValue: 'Insufficient Data',
        },
        {
          name: 'Operating Efficiency',
          score: 0,
          maxScore: 25,
          weightPercent: 25,
          status: 'neutral',
          description: 'Requires completed monthly inflow/outflow ledger data.',
          metricValue: 'Insufficient Data',
        },
        {
          name: 'Expense Concentration',
          score: 0,
          maxScore: 20,
          weightPercent: 20,
          status: 'neutral',
          description: 'Requires category-level spend history across completed months.',
          metricValue: 'Insufficient Data',
        },
        {
          name: 'Revenue Trajectory',
          score: 0,
          maxScore: 15,
          weightPercent: 15,
          status: 'neutral',
          description: 'Requires multi-month verified revenue history.',
          metricValue: 'Insufficient Data',
        },
      ],
      methodology: 'Deterministic Venture Financial Model: Score = Runway (40) + Efficiency (25) + Diversification (20) + Growth (15).',
      hasSufficientData: false,
      summary: 'Insufficient historical ledger data to compute a meaningful composite score. Minimum 1 completed calendar month required.',
    };
  }

  const { inflows, outflows, categoryOutflows } = getMonthlyTotalsMap(transactions);
  const currentCash = calculateCashOnHand(transactions, startingBalance);

  // 1. Calculate Average Monthly Net Burn across completed months
  // NB_m = max(0, O_m - I_m)
  let totalNetBurn = 0;
  let totalInflow = 0;
  let totalOutflow = 0;
  const combinedCategorySpend = new Map<string, number>();

  for (const m of completedMonths) {
    const mOut = outflows.get(m) || 0;
    const mIn = inflows.get(m) || 0;
    const mDeficit = Math.max(0, mOut - mIn);

    totalNetBurn += mDeficit;
    totalInflow += mIn;
    totalOutflow += mOut;

    const mCats = categoryOutflows.get(m);
    if (mCats) {
      for (const [cat, amt] of mCats.entries()) {
        combinedCategorySpend.set(cat, (combinedCategorySpend.get(cat) || 0) + amt);
      }
    }
  }

  const averageNetBurn = totalNetBurn / k;
  const isCashFlowPositive = averageNetBurn <= 0;
  const runwayMonths = isCashFlowPositive ? 999 : currentCash / averageNetBurn;

  // Factor 1: Runway Buffer (Max 40)
  let sRunway = 0;
  let runwayStatus: 'healthy' | 'caution' | 'critical' | 'neutral' = 'healthy';
  let runwayMetricValue = '';

  if (isCashFlowPositive && currentCash > 0) {
    sRunway = 40;
    runwayStatus = 'healthy';
    runwayMetricValue = 'Cash-flow positive';
  } else if (currentCash <= 0) {
    sRunway = 0;
    runwayStatus = 'critical';
    runwayMetricValue = `0.0 Mos (${getCurrencySymbol(currency)}0 cash)`;
  } else if (runwayMonths >= 18.0) {
    sRunway = 40;
    runwayStatus = 'healthy';
    runwayMetricValue = `${runwayMonths.toFixed(1)} Mos (>= 18 mos)`;
  } else if (runwayMonths >= 12.0) {
    sRunway = Math.round(30 + ((runwayMonths - 12.0) / (18.0 - 12.0)) * 9);
    runwayStatus = 'healthy';
    runwayMetricValue = `${runwayMonths.toFixed(1)} Mos`;
  } else if (runwayMonths >= 6.0) {
    sRunway = Math.round(15 + ((runwayMonths - 6.0) / (12.0 - 6.0)) * 14);
    runwayStatus = 'caution';
    runwayMetricValue = `${runwayMonths.toFixed(1)} Mos`;
  } else if (runwayMonths >= 3.0) {
    sRunway = Math.round(5 + ((runwayMonths - 3.0) / (6.0 - 3.0)) * 9);
    runwayStatus = 'caution';
    runwayMetricValue = `${runwayMonths.toFixed(1)} Mos`;
  } else {
    sRunway = Math.round((runwayMonths / 3.0) * 4);
    runwayStatus = 'critical';
    runwayMetricValue = `${runwayMonths.toFixed(1)} Mos (< 3 mos)`;
  }

  // Factor 2: Operating Efficiency (Max 25)
  let sEfficiency = 0;
  let efficiencyStatus: 'healthy' | 'caution' | 'critical' | 'neutral' = 'healthy';
  let efficiencyMetricValue = '';

  if (totalOutflow === 0 && totalInflow === 0) {
    sEfficiency = 0;
    efficiencyStatus = 'neutral';
    efficiencyMetricValue = 'No expenses or inflows';
  } else if (totalOutflow === 0 && totalInflow > 0) {
    sEfficiency = 25;
    efficiencyStatus = 'healthy';
    efficiencyMetricValue = '100% revenue coverage (0 expenses)';
  } else {
    const coverageRatio = totalInflow / totalOutflow;
    efficiencyMetricValue = `${Math.round(coverageRatio * 100)}% revenue coverage`;

    if (coverageRatio >= 1.0) {
      sEfficiency = 25;
      efficiencyStatus = 'healthy';
    } else if (coverageRatio >= 0.50) {
      sEfficiency = Math.round(18 + ((coverageRatio - 0.50) / (1.0 - 0.50)) * 6);
      efficiencyStatus = 'healthy';
    } else if (coverageRatio >= 0.20) {
      sEfficiency = Math.round(10 + ((coverageRatio - 0.20) / (0.50 - 0.20)) * 7);
      efficiencyStatus = 'caution';
    } else if (coverageRatio > 0.0) {
      sEfficiency = Math.round(5 + (coverageRatio / 0.20) * 4);
      efficiencyStatus = 'caution';
    } else {
      // Pre-revenue (coverageRatio === 0)
      if (runwayMonths >= 12.0) {
        sEfficiency = 4;
        efficiencyStatus = 'caution';
        efficiencyMetricValue = 'Pre-revenue (funded runway >= 12 mos)';
      } else {
        sEfficiency = 0;
        efficiencyStatus = 'critical';
        efficiencyMetricValue = 'Pre-revenue (runway < 12 mos)';
      }
    }
  }

  // Factor 3: Expense Concentration (Max 20)
  let sConcentration = 20;
  let concentrationStatus: 'healthy' | 'caution' | 'critical' | 'neutral' = 'healthy';
  let concentrationMetricValue = '';

  if (totalOutflow === 0) {
    sConcentration = 20;
    concentrationStatus = 'healthy';
    concentrationMetricValue = 'No expenses recorded';
  } else {
    let maxCategorySpend = 0;
    let topCategory = 'None';
    for (const [cat, amt] of combinedCategorySpend.entries()) {
      if (amt > maxCategorySpend) {
        maxCategorySpend = amt;
        topCategory = cat;
      }
    }
    const csMax = maxCategorySpend / totalOutflow;
    concentrationMetricValue = `${topCategory} (${Math.round(csMax * 100)}%)`;

    if (csMax <= 0.40) {
      sConcentration = 20;
      concentrationStatus = 'healthy';
    } else if (csMax <= 0.60) {
      sConcentration = Math.round(19 - ((csMax - 0.40) / (0.60 - 0.40)) * 7);
      concentrationStatus = 'healthy';
    } else if (csMax <= 0.80) {
      sConcentration = Math.round(11 - ((csMax - 0.60) / (0.80 - 0.60)) * 6);
      concentrationStatus = 'caution';
    } else {
      sConcentration = 2;
      concentrationStatus = 'critical';
    }
  }

  // Factor 4: Revenue Trajectory & Stability (Max 15)
  let sGrowth = 0;
  let growthStatus: 'healthy' | 'caution' | 'critical' | 'neutral' = 'healthy';
  let growthMetricValue = '';

  const m1 = completedMonths[0]; // Latest completed month M-1
  const m2 = completedMonths[1]; // Prior completed month M-2
  const rev1 = m1 ? inflows.get(m1) || 0 : 0;
  const rev2 = m2 ? inflows.get(m2) || 0 : 0;

  if (m1 && m2 && rev1 > 0 && rev2 > 0) {
    const growthPercent = ((rev1 - rev2) / rev2) * 100;
    growthMetricValue = `${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}% MoM`;

    if (growthPercent >= 15.0) {
      sGrowth = 15;
      growthStatus = 'healthy';
    } else if (growthPercent >= 5.0) {
      sGrowth = 12;
      growthStatus = 'healthy';
    } else if (growthPercent >= 0.0) {
      sGrowth = 9;
      growthStatus = 'caution';
    } else if (growthPercent >= -15.0) {
      sGrowth = 5;
      growthStatus = 'caution';
    } else {
      sGrowth = 2;
      growthStatus = 'critical';
    }
  } else if (rev1 === 0 && (k < 2 || rev2 === 0)) {
    // Pre-revenue
    if (runwayMonths >= 12.0) {
      sGrowth = 8;
      growthStatus = 'caution';
      growthMetricValue = 'Pre-revenue (stable runway)';
    } else {
      sGrowth = 3;
      growthStatus = 'critical';
      growthMetricValue = 'Pre-revenue (tight runway)';
    }
  } else {
    // Only 1 completed month with revenue
    sGrowth = 7;
    growthStatus = 'caution';
    growthMetricValue = 'Baseline (1 completed revenue month)';
  }

  // Composite Score
  const totalScore = Math.min(100, Math.max(0, sRunway + sEfficiency + sConcentration + sGrowth));

  let category: HealthCategory = 'Watchlist';
  if (totalScore >= 80) category = 'Strong';
  else if (totalScore >= 60) category = 'Moderate';
  else if (totalScore >= 40) category = 'Watchlist';
  else category = 'Critical';

  const factors: HealthFactorContribution[] = [
    {
      name: 'Runway Buffer',
      score: sRunway,
      maxScore: 40,
      weightPercent: 40,
      status: runwayStatus,
      description: `Runway of ${runwayMetricValue} provides ${sRunway}/40 capital longevity points.`,
      metricValue: runwayMetricValue,
    },
    {
      name: 'Operating Efficiency',
      score: sEfficiency,
      maxScore: 25,
      weightPercent: 25,
      status: efficiencyStatus,
      description: `Inflows cover ${efficiencyMetricValue} of operating outflows.`,
      metricValue: efficiencyMetricValue,
    },
    {
      name: 'Expense Concentration',
      score: sConcentration,
      maxScore: 20,
      weightPercent: 20,
      status: concentrationStatus,
      description: `Largest expenditure category is ${concentrationMetricValue}.`,
      metricValue: concentrationMetricValue,
    },
    {
      name: 'Revenue Trajectory',
      score: sGrowth,
      maxScore: 15,
      weightPercent: 15,
      status: growthStatus,
      description: `Trailing revenue performance: ${growthMetricValue}.`,
      metricValue: growthMetricValue,
    },
  ];

  let summary = '';
  switch (category) {
    case 'Strong':
      summary = 'High composite financial-health score based on the defined deterministic factors.';
      break;
    case 'Moderate':
      summary = 'Moderate composite financial-health score with some factors requiring monitoring.';
      break;
    case 'Watchlist':
      summary = 'Composite score indicates one or more financial factors require closer monitoring.';
      break;
    case 'Critical':
      summary = 'Low composite financial-health score requiring attention to the underlying contributing factors.';
      break;
    default:
      summary = 'Insufficient historical ledger data to compute a meaningful composite score.';
  }

  return {
    score: totalScore,
    maxScore: 100,
    category,
    factors,
    methodology: 'Deterministic Venture Model: Score = Runway (40) + Efficiency (25) + Diversification (20) + Growth (15).',
    hasSufficientData: true,
    summary,
  };
}
