import {
  Transaction,
  Workspace,
  AttentionItem,
  FinancialThresholdConfig,
} from '@/types/finance';
import { calculateCashOnHand, formatCurrency } from './calculator';
import { getReportingAnchorAndCompletedMonths, getMonthlyTotalsMap } from './financial-health';

export const DEFAULT_FINANCIAL_THRESHOLDS: FinancialThresholdConfig = {
  runwayCriticalMonths: 3.0,
  runwayWarningMonths: 6.0,
  expenseSpikePercent: 30.0,
  minExpenseSpikeAmount: 2000,
  categoryConcentrationPercent: 60.0,
  negativeNetFlowThreshold: 0,
};

/**
 * Deterministic attention and risk rule evaluator
 */
export function evaluateAttentionItems(
  transactions: Transaction[],
  workspace: Workspace,
  customThresholds?: Partial<FinancialThresholdConfig>
): AttentionItem[] {
  const activeTxs = transactions.filter((t) => t.status !== 'failed');
  if (activeTxs.length === 0) {
    return [];
  }

  const thresholds: FinancialThresholdConfig = {
    ...DEFAULT_FINANCIAL_THRESHOLDS,
    ...customThresholds,
    // If workspace defines alert_runway_threshold, respect it for warning
    runwayWarningMonths: workspace.alert_runway_threshold ?? DEFAULT_FINANCIAL_THRESHOLDS.runwayWarningMonths,
  };

  const { reportingAnchorMonth, completedMonths, k } = getReportingAnchorAndCompletedMonths(activeTxs);
  if (!reportingAnchorMonth) return [];

  const { inflows, outflows, categoryOutflows } = getMonthlyTotalsMap(activeTxs);
  const currentCash = calculateCashOnHand(activeTxs, workspace.starting_cash);

  // Compute average monthly net burn across completed months if k >= 1
  let totalNetBurn = 0;
  if (k > 0) {
    for (const m of completedMonths) {
      const mOut = outflows.get(m) || 0;
      const mIn = inflows.get(m) || 0;
      totalNetBurn += Math.max(0, mOut - mIn);
    }
  }

  const averageNetBurn = k > 0 ? totalNetBurn / k : 0;
  const isCashFlowPositive = averageNetBurn <= 0;
  const runwayMonths = isCashFlowPositive ? 999 : currentCash / averageNetBurn;

  const items: AttentionItem[] = [];

  // Rule 1 & 2: Runway alerts (only when burn baseline exists and burning cash)
  if (k > 0 && !isCashFlowPositive) {
    if (runwayMonths < thresholds.runwayCriticalMonths) {
      items.push({
        id: `attn-runway-critical-${reportingAnchorMonth}`,
        ruleId: 'ATTN_RUNWAY_CRITICAL',
        severity: 'critical',
        title: 'Critical Runway Alert',
        detectedIssue: `Runway has dropped to ${runwayMonths.toFixed(1)} months`,
        supportingMetric: `${formatCurrency(currentCash, workspace.currency)} cash remaining against ${formatCurrency(averageNetBurn, workspace.currency)}/mo average net burn.`,
        suggestedAction: 'Immediate action required: initiate emergency runway preservation, freeze non-essential hiring, and accelerate financing conversations.',
        actionType: 'adjust_runway',
      });
    } else if (runwayMonths < thresholds.runwayWarningMonths) {
      items.push({
        id: `attn-runway-warning-${reportingAnchorMonth}`,
        ruleId: 'ATTN_RUNWAY_WARNING',
        severity: 'warning',
        title: 'Runway Below Safety Floor',
        detectedIssue: `Runway is ${runwayMonths.toFixed(1)} months (safety floor: ${thresholds.runwayWarningMonths} mos)`,
        supportingMetric: `Net cash burn of ${formatCurrency(averageNetBurn, workspace.currency)}/mo leaves ${runwayMonths.toFixed(1)} months of operational runway.`,
        suggestedAction: 'Review 90-day discretionary spend and model capital runway extension scenarios in the scenario planner.',
        actionType: 'adjust_runway',
      });
    }
  }

  // Rule 3: Expense Spikes in Reporting Anchor Month M0 vs Preceding Completed Months Baseline
  if (k > 0) {
    const m0CatMap = categoryOutflows.get(reportingAnchorMonth);
    if (m0CatMap) {
      for (const [cat, m0Amount] of m0CatMap.entries()) {
        // Compute prior average in this category across completed months
        let priorCatTotal = 0;
        for (const m of completedMonths) {
          const priorMonthCats = categoryOutflows.get(m);
          priorCatTotal += priorMonthCats?.get(cat) || 0;
        }
        const priorCatAvg = priorCatTotal / k;

        // If prior average is 0, no percentage-based spike alert
        if (priorCatAvg > 0) {
          const delta = m0Amount - priorCatAvg;
          const spikePercent = ((m0Amount - priorCatAvg) / priorCatAvg) * 100;

          if (spikePercent > thresholds.expenseSpikePercent && delta >= thresholds.minExpenseSpikeAmount) {
            // Find recent transactions in M0 contributing to this category
            const relatedTxs = activeTxs
              .filter(
                (t) =>
                  t.transaction_type === 'expense' &&
                  t.category === cat &&
                  t.transaction_date.startsWith(reportingAnchorMonth)
              )
              .slice(0, 3)
              .map((t) => ({
                id: t.id,
                description: t.description,
                amount: Number(t.amount),
                transaction_date: t.transaction_date,
              }));

            items.push({
              id: `attn-spike-${cat.toLowerCase().replace(/\s+/g, '-')}-${reportingAnchorMonth}`,
              ruleId: 'ATTN_EXPENSE_SPIKE',
              severity: 'warning',
              title: `Expense Spike in ${cat}`,
              detectedIssue: `${cat} spending surged +${spikePercent.toFixed(0)}% in ${reportingAnchorMonth}`,
              supportingMetric: `${formatCurrency(m0Amount, workspace.currency)} spent vs ${formatCurrency(priorCatAvg, workspace.currency)} prior monthly average (+${formatCurrency(delta, workspace.currency)}).`,
              affectedCategory: cat,
              affectedTransactions: relatedTxs,
              suggestedAction: `Audit recent charges in ${cat} to verify whether this represents a planned one-time capital expense or recurring vendor increase.`,
              actionType: 'audit_category',
            });
          }
        }
      }
    }
  }

  // Rule 4: Concentration Alert in Reporting Anchor Month M0 Only
  const m0TotalOutflow = outflows.get(reportingAnchorMonth) || 0;
  if (m0TotalOutflow > 0) {
    const m0CatMap = categoryOutflows.get(reportingAnchorMonth);
    if (m0CatMap) {
      for (const [cat, amt] of m0CatMap.entries()) {
        const sharePercent = (amt / m0TotalOutflow) * 100;
        if (sharePercent > thresholds.categoryConcentrationPercent) {
          items.push({
            id: `attn-concentration-${cat.toLowerCase().replace(/\s+/g, '-')}-${reportingAnchorMonth}`,
            ruleId: 'ATTN_CONCENTRATION',
            severity: 'info',
            title: `High Expense Concentration in ${cat}`,
            detectedIssue: `${cat} represents ${sharePercent.toFixed(0)}% of total monthly outflow in ${reportingAnchorMonth}`,
            supportingMetric: `${formatCurrency(amt, workspace.currency)} of total ${formatCurrency(m0TotalOutflow, workspace.currency)} monthly operating spend.`,
            affectedCategory: cat,
            suggestedAction: `Maintain a liquid cash reserve covering at least 3 months of ${cat} commitments.`,
            actionType: 'review_expenses',
          });
        }
      }
    }
  }

  // Rule 5: Negative Net Cash Flow in Reporting Anchor Month M0
  const m0Inflow = inflows.get(reportingAnchorMonth) || 0;
  const m0NetFlow = m0Inflow - m0TotalOutflow;
  if (m0NetFlow < -thresholds.negativeNetFlowThreshold && runwayMonths < 12.0) {
    const deficit = Math.abs(m0NetFlow);
    items.push({
      id: `attn-neg-ncf-${reportingAnchorMonth}`,
      ruleId: 'ATTN_NEGATIVE_CASHFLOW',
      severity: 'warning',
      title: 'Operating Cash Deficit',
      detectedIssue: `Net cash deficit of ${formatCurrency(deficit, workspace.currency)} in ${reportingAnchorMonth}`,
      supportingMetric: `Gross Inflows: ${formatCurrency(m0Inflow, workspace.currency)} vs Gross Outflows: ${formatCurrency(m0TotalOutflow, workspace.currency)}.`,
      suggestedAction: 'Track receivables collection timing and examine vendor payment terms to narrow the monthly deficit.',
      actionType: 'review_expenses',
    });
  }

  // Deduplicate and sort items by severity: critical -> warning -> info
  const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2, system: 3 };
  const seenKeys = new Set<string>();
  const deduplicatedItems: AttentionItem[] = [];

  for (const item of items) {
    const key = `${item.ruleId}-${item.affectedCategory || 'workspace'}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicatedItems.push(item);
    }
  }

  deduplicatedItems.sort((a, b) => (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99));

  return deduplicatedItems;
}
