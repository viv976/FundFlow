import type {
  Transaction,
  Workspace,
  RiskAlert,
  RiskSignalType,
  FinancialThresholdConfig,
} from '@/types/finance';

export type { RiskAlert, RiskSignalType };

import { calculateCashOnHand, formatCurrency } from './calculator';
import { getReportingAnchorAndCompletedMonths, getMonthlyTotalsMap } from './financial-health';
import { DEFAULT_FINANCIAL_THRESHOLDS } from './attention-detector';

export interface ExtendedRiskThresholdConfig extends FinancialThresholdConfig {
  burnSurgePercent: number; // e.g. 25% MoM net burn surge
  minBurnSurgeAmount: number; // min absolute dollar increase for burn surge
  revenueDeclinePercent: number; // e.g. 15% MoM revenue drop
  minRevenueDeclineAmount: number; // min dollar drop for revenue alert
  abnormalTransactionPercent: number; // e.g. single tx > 25% of monthly outflow
  minAbnormalTransactionAmount: number; // min absolute amount to flag as abnormal
  cashContractionPercent: number; // e.g. cash dropped > 15% over trailing window
}

export const DEFAULT_RISK_THRESHOLDS: ExtendedRiskThresholdConfig = {
  ...DEFAULT_FINANCIAL_THRESHOLDS,
  categoryConcentrationPercent: 50.0,
  burnSurgePercent: 25.0,
  minBurnSurgeAmount: 2500,
  revenueDeclinePercent: 15.0,
  minRevenueDeclineAmount: 1000,
  abnormalTransactionPercent: 25.0,
  minAbnormalTransactionAmount: 5000,
  cashContractionPercent: 15.0,
};


/**
 * Deterministic Risk Intelligence Evaluator
 * Evaluates 7 core financial signals strictly from verified ledger transactions.
 * Zero probabilistic models, zero synthetic confidence scores.
 */
export function evaluateRiskSignals(
  transactions: Transaction[],
  workspace: Workspace,
  customThresholds?: Partial<ExtendedRiskThresholdConfig>
): RiskAlert[] {
  const activeTxs = transactions.filter((t) => t.status !== 'failed');
  if (activeTxs.length === 0) {
    return [];
  }

  const thresholds: ExtendedRiskThresholdConfig = {
    ...DEFAULT_RISK_THRESHOLDS,
    ...customThresholds,
    runwayWarningMonths:
      workspace.alert_runway_threshold ?? DEFAULT_RISK_THRESHOLDS.runwayWarningMonths,
  };

  const currency = workspace.currency || 'USD';
  const { reportingAnchorMonth, completedMonths, k } =
    getReportingAnchorAndCompletedMonths(activeTxs);

  if (!reportingAnchorMonth) {
    return [];
  }

  const { inflows, outflows, categoryOutflows } = getMonthlyTotalsMap(activeTxs);
  const currentCash = calculateCashOnHand(activeTxs, workspace.starting_cash);

  // Trailing average completed burn
  let totalCompletedNetBurn = 0;
  let totalCompletedOutflow = 0;
  let totalCompletedInflow = 0;

  if (k > 0) {
    for (const m of completedMonths) {
      const mOut = outflows.get(m) || 0;
      const mIn = inflows.get(m) || 0;
      totalCompletedOutflow += mOut;
      totalCompletedInflow += mIn;
      totalCompletedNetBurn += Math.max(0, mOut - mIn);
    }
  }

  const averageCompletedNetBurn = k > 0 ? totalCompletedNetBurn / k : 0;
  const isCashFlowPositive = averageCompletedNetBurn <= 0;
  const runwayMonths = isCashFlowPositive ? 999 : currentCash / averageCompletedNetBurn;

  const alerts: RiskAlert[] = [];

  // =========================================================================
  // SIGNAL 1: RUNWAY_BELOW_THRESHOLD
  // =========================================================================
  if (k > 0 && !isCashFlowPositive) {
    if (runwayMonths < thresholds.runwayCriticalMonths) {
      alerts.push({
        id: `risk-runway-critical-${reportingAnchorMonth}`,
        ruleId: 'RUNWAY_BELOW_THRESHOLD',
        detectionMechanism: 'DETERMINISTIC_DETECTION',
        severity: 'critical',
        title: 'Critical Runway Depletion',
        explanation: `Estimated operational runway has dropped to ${runwayMonths.toFixed(1)} months, falling below the critical threshold of ${thresholds.runwayCriticalMonths.toFixed(1)} months.`,
        supportingData: {
          primaryMetric: `Runway: ${runwayMonths.toFixed(1)} months`,
          baselineValue: `${thresholds.runwayWarningMonths.toFixed(1)} months (safety floor)`,
          observedValue: `${runwayMonths.toFixed(1)} months`,
          thresholdValue: `${thresholds.runwayCriticalMonths.toFixed(1)} months`,
          affectedAmount: currentCash,
          currency,
          evidenceItems: [
            `Current Cash on Hand: ${formatCurrency(currentCash, currency)}`,
            `Average Net Burn: ${formatCurrency(averageCompletedNetBurn, currency)}/mo`,
            `Formula: Cash / Average Net Burn = ${runwayMonths.toFixed(1)} months`,
          ],
        },
        affectedPeriod: `${reportingAnchorMonth} (Forward Projection)`,
        suggestedAction:
          'Implement immediate cash preservation, pause all discretionary hiring, and evaluate runway extension scenarios in the Scenario Planner.',
        status: 'active',
        createdAt: new Date().toISOString(),
        actionType: 'adjust_runway',
      });
    } else if (runwayMonths < thresholds.runwayWarningMonths) {
      alerts.push({
        id: `risk-runway-warning-${reportingAnchorMonth}`,
        ruleId: 'RUNWAY_BELOW_THRESHOLD',
        detectionMechanism: 'DETERMINISTIC_DETECTION',
        severity: 'warning',
        title: 'Runway Below Safety Floor',
        explanation: `Operational runway of ${runwayMonths.toFixed(1)} months is below the configured safety floor of ${thresholds.runwayWarningMonths.toFixed(1)} months.`,
        supportingData: {
          primaryMetric: `Runway: ${runwayMonths.toFixed(1)} months`,
          baselineValue: `${thresholds.runwayWarningMonths.toFixed(1)} months`,
          observedValue: `${runwayMonths.toFixed(1)} months`,
          thresholdValue: `${thresholds.runwayWarningMonths.toFixed(1)} months`,
          affectedAmount: currentCash,
          currency,
          evidenceItems: [
            `Current Cash: ${formatCurrency(currentCash, currency)}`,
            `Monthly Net Burn: ${formatCurrency(averageCompletedNetBurn, currency)}/mo`,
          ],
        },
        affectedPeriod: `${reportingAnchorMonth} (Forward Projection)`,
        suggestedAction:
          'Review discretionary spend and model capital extension scenarios in the Scenario Planner.',
        status: 'active',
        createdAt: new Date().toISOString(),
        actionType: 'adjust_runway',
      });
    }
  }

  // =========================================================================
  // SIGNAL 2: RAPIDLY_INCREASING_BURN
  // =========================================================================
  if (k >= 1) {
    const latestMonthOut = outflows.get(reportingAnchorMonth) || 0;
    const latestMonthIn = inflows.get(reportingAnchorMonth) || 0;
    const latestNetBurn = Math.max(0, latestMonthOut - latestMonthIn);

    // Prior baseline net burn
    const priorBaselineBurn = averageCompletedNetBurn;

    if (priorBaselineBurn > 0) {
      const burnDelta = latestNetBurn - priorBaselineBurn;
      const surgePercent = ((latestNetBurn - priorBaselineBurn) / priorBaselineBurn) * 100;

      if (surgePercent >= thresholds.burnSurgePercent && burnDelta >= thresholds.minBurnSurgeAmount) {
        const isCriticalBurn = runwayMonths < 6.0 && surgePercent >= 35.0;
        alerts.push({
          id: `risk-burn-surge-${reportingAnchorMonth}`,
          ruleId: 'RAPIDLY_INCREASING_BURN',
          detectionMechanism: 'DETERMINISTIC_DETECTION',
          severity: isCriticalBurn ? 'critical' : 'warning',
          title: 'Rapidly Increasing Burn Rate',
          explanation: `Monthly net burn surged by +${surgePercent.toFixed(0)}% (+${formatCurrency(burnDelta, currency)}) in ${reportingAnchorMonth} compared to the trailing average.`,
          supportingData: {
            primaryMetric: `Burn Surge: +${surgePercent.toFixed(0)}%`,
            baselineValue: `${formatCurrency(priorBaselineBurn, currency)}/mo`,
            observedValue: `${formatCurrency(latestNetBurn, currency)}/mo`,
            thresholdValue: `+${thresholds.burnSurgePercent}% surge`,
            variancePercent: surgePercent,
            affectedAmount: burnDelta,
            currency,
            evidenceItems: [
              `Prior Trailing Burn: ${formatCurrency(priorBaselineBurn, currency)}/mo`,
              `Current Month Net Burn: ${formatCurrency(latestNetBurn, currency)}/mo`,
              `Net Increase: +${formatCurrency(burnDelta, currency)}`,
            ],
          },
          affectedPeriod: reportingAnchorMonth,
          suggestedAction:
            'Audit recent department spending and run scenario modeling to assess impact on future runway.',
          status: 'active',
          createdAt: new Date().toISOString(),
          actionType: 'model_scenario',
        });
      }
    }
  }

  // =========================================================================
  // SIGNAL 3: DECREASING_CASH_TRAJECTORY
  // =========================================================================
  // Look at cumulative cash change across recent months
  const anchorInflow = inflows.get(reportingAnchorMonth) || 0;
  const anchorOutflow = outflows.get(reportingAnchorMonth) || 0;
  const anchorNet = anchorInflow - anchorOutflow;

  if (anchorNet < 0) {
    const priorCashEstimated = currentCash - anchorNet; // Cash before anchor net flow
    const cashDropPercent = priorCashEstimated > 0 ? (Math.abs(anchorNet) / priorCashEstimated) * 100 : 0;

    if (cashDropPercent >= thresholds.cashContractionPercent || (k >= 2 && totalCompletedOutflow > totalCompletedInflow)) {
      const isCriticalCash = runwayMonths < 4.0 || cashDropPercent >= 30.0;
      alerts.push({
        id: `risk-cash-drop-${reportingAnchorMonth}`,
        ruleId: 'DECREASING_CASH_TRAJECTORY',
        detectionMechanism: 'DETERMINISTIC_DETECTION',
        severity: isCriticalCash ? 'critical' : 'warning',
        title: 'Negative Cash Flow Trajectory',
        explanation: `Net cash decreased by ${formatCurrency(Math.abs(anchorNet), currency)} (${cashDropPercent.toFixed(0)}% drop) in ${reportingAnchorMonth}.`,
        supportingData: {
          primaryMetric: `Cash Drawdown: -${cashDropPercent.toFixed(0)}%`,
          baselineValue: formatCurrency(priorCashEstimated, currency),
          observedValue: formatCurrency(currentCash, currency),
          thresholdValue: `-${thresholds.cashContractionPercent}% max drawdown`,
          variancePercent: -cashDropPercent,
          affectedAmount: Math.abs(anchorNet),
          currency,
          evidenceItems: [
            `Current Cash on Hand: ${formatCurrency(currentCash, currency)}`,
            `Monthly Net Cash Flow: -${formatCurrency(Math.abs(anchorNet), currency)}`,
            `Total Inflows: ${formatCurrency(anchorInflow, currency)} vs Outflows: ${formatCurrency(anchorOutflow, currency)}`,
          ],
        },
        affectedPeriod: reportingAnchorMonth,
        suggestedAction:
          'Audit non-critical vendor disbursements and evaluate immediate cash conservation measures.',
        status: 'active',
        createdAt: new Date().toISOString(),
        actionType: 'review_expenses',
      });
    }
  }

  // =========================================================================
  // SIGNAL 4: REVENUE_DECLINE
  // =========================================================================
  if (completedMonths.length >= 2) {
    const mLatestCompleted = completedMonths[0]; // M-1
    const mPriorCompleted = completedMonths[1]; // M-2
    const revLatest = inflows.get(mLatestCompleted) || 0;
    const revPrior = inflows.get(mPriorCompleted) || 0;

    if (revPrior > 0 && revLatest < revPrior) {
      const revDrop = revPrior - revLatest;
      const revDropPercent = (revDrop / revPrior) * 100;

      if (
        revDropPercent >= thresholds.revenueDeclinePercent &&
        revDrop >= thresholds.minRevenueDeclineAmount
      ) {
        alerts.push({
          id: `risk-rev-decline-${mLatestCompleted}`,
          ruleId: 'REVENUE_DECLINE',
          detectionMechanism: 'DETERMINISTIC_DETECTION',
          severity: revDropPercent >= 35.0 ? 'critical' : 'warning',
          title: 'Month-over-Month Revenue Decline',
          explanation: `Gross revenue fell by -${revDropPercent.toFixed(1)}% (-${formatCurrency(revDrop, currency)}) from ${mPriorCompleted} to ${mLatestCompleted}.`,
          supportingData: {
            primaryMetric: `Revenue Decline: -${revDropPercent.toFixed(1)}%`,
            baselineValue: `${formatCurrency(revPrior, currency)} (${mPriorCompleted})`,
            observedValue: `${formatCurrency(revLatest, currency)} (${mLatestCompleted})`,
            thresholdValue: `-${thresholds.revenueDeclinePercent}% alert threshold`,
            variancePercent: -revDropPercent,
            affectedAmount: revDrop,
            currency,
            evidenceItems: [
              `Prior Revenue (${mPriorCompleted}): ${formatCurrency(revPrior, currency)}`,
              `Latest Completed Revenue (${mLatestCompleted}): ${formatCurrency(revLatest, currency)}`,
              `Net Contraction: -${formatCurrency(revDrop, currency)}`,
            ],
          },
          affectedPeriod: `${mPriorCompleted} → ${mLatestCompleted}`,
          suggestedAction:
            'Examine customer accounts for late renewals, churn, or delayed invoicing cycles.',
          status: 'active',
          createdAt: new Date().toISOString(),
          actionType: 'review_expenses',
        });
      }
    }
  }

  // =========================================================================
  // SIGNAL 5: EXPENSE_CONCENTRATION
  // =========================================================================
  const m0TotalOutflow = outflows.get(reportingAnchorMonth) || 0;
  if (m0TotalOutflow > 0) {
    const m0CatMap = categoryOutflows.get(reportingAnchorMonth);
    if (m0CatMap) {
      for (const [cat, amt] of m0CatMap.entries()) {
        const sharePercent = (amt / m0TotalOutflow) * 100;
        if (sharePercent > thresholds.categoryConcentrationPercent) {
          alerts.push({
            id: `risk-concentration-${cat.toLowerCase().replace(/\s+/g, '-')}-${reportingAnchorMonth}`,
            ruleId: 'EXPENSE_CONCENTRATION',
            detectionMechanism: 'DETERMINISTIC_DETECTION',
            severity: sharePercent > 65.0 ? 'warning' : 'info',
            title: `High Expense Concentration in ${cat}`,
            explanation: `${cat} represents ${sharePercent.toFixed(0)}% of total monthly outflow in ${reportingAnchorMonth}.`,
            supportingData: {
              primaryMetric: `Expense Share: ${sharePercent.toFixed(1)}%`,
              baselineValue: `${thresholds.categoryConcentrationPercent.toFixed(1)}% ceiling`,
              observedValue: `${sharePercent.toFixed(1)}%`,
              thresholdValue: `${thresholds.categoryConcentrationPercent}%`,
              affectedAmount: amt,
              currency,
              evidenceItems: [
                `${cat} Outflow: ${formatCurrency(amt, currency)}`,
                `Total Monthly Spend: ${formatCurrency(m0TotalOutflow, currency)}`,
                `Concentration Ratio: ${sharePercent.toFixed(1)}%`,
              ],
            },
            affectedPeriod: reportingAnchorMonth,
            suggestedAction: `Maintain liquid cash reserves covering at least 3 months of ${cat} commitments and review vendor contract terms.`,
            status: 'active',
            createdAt: new Date().toISOString(),
            category: cat,
            actionType: 'audit_category',
          });
        }
      }
    }
  }

  // =========================================================================
  // SIGNAL 6: UNUSUAL_EXPENSE_SPIKE
  // =========================================================================
  if (k > 0) {
    const m0CatMap = categoryOutflows.get(reportingAnchorMonth);
    if (m0CatMap) {
      for (const [cat, m0Amount] of m0CatMap.entries()) {
        let priorCatTotal = 0;
        for (const m of completedMonths) {
          const priorMonthCats = categoryOutflows.get(m);
          priorCatTotal += priorMonthCats?.get(cat) || 0;
        }
        const priorCatAvg = priorCatTotal / k;

        if (priorCatAvg > 0) {
          const delta = m0Amount - priorCatAvg;
          const spikePercent = ((m0Amount - priorCatAvg) / priorCatAvg) * 100;

          if (spikePercent > thresholds.expenseSpikePercent && delta >= thresholds.minExpenseSpikeAmount) {
            alerts.push({
              id: `risk-spike-${cat.toLowerCase().replace(/\s+/g, '-')}-${reportingAnchorMonth}`,
              ruleId: 'UNUSUAL_EXPENSE_SPIKE',
              detectionMechanism: 'DETERMINISTIC_DETECTION',
              severity: 'warning',
              title: `Unusual Expense Spike in ${cat}`,
              explanation: `${cat} spend surged +${spikePercent.toFixed(0)}% in ${reportingAnchorMonth} compared to the trailing average.`,
              supportingData: {
                primaryMetric: `Category Spike: +${spikePercent.toFixed(0)}%`,
                baselineValue: `${formatCurrency(priorCatAvg, currency)}/mo avg`,
                observedValue: `${formatCurrency(m0Amount, currency)}`,
                thresholdValue: `+${thresholds.expenseSpikePercent}% threshold`,
                variancePercent: spikePercent,
                affectedAmount: delta,
                currency,
                evidenceItems: [
                  `Prior Monthly Average: ${formatCurrency(priorCatAvg, currency)}`,
                  `Current Period Spend: ${formatCurrency(m0Amount, currency)}`,
                  `Incremental Variance: +${formatCurrency(delta, currency)}`,
                ],
              },
              affectedPeriod: reportingAnchorMonth,
              suggestedAction: `Audit recent charges in ${cat} to determine whether this represents a planned one-time capital investment or recurring expansion.`,
              status: 'active',
              createdAt: new Date().toISOString(),
              category: cat,
              actionType: 'audit_category',
            });
          }
        }
      }
    }
  }

  // =========================================================================
  // SIGNAL 7: ABNORMAL_TRANSACTION
  // =========================================================================
  // Inspect active transactions in the reporting anchor month
  const anchorTxs = activeTxs.filter(
    (t) => t.transaction_type === 'expense' && t.transaction_date.startsWith(reportingAnchorMonth)
  );

  for (const t of anchorTxs) {
    const amt = Number(t.amount || 0);
    if (m0TotalOutflow > 0 && amt >= thresholds.minAbnormalTransactionAmount) {
      const shareOfMonthlySpend = (amt / m0TotalOutflow) * 100;
      if (shareOfMonthlySpend >= thresholds.abnormalTransactionPercent) {
        const isCriticalTx = shareOfMonthlySpend >= 50.0;
        alerts.push({
          id: `risk-abnormal-tx-${t.id}`,
          ruleId: 'ABNORMAL_TRANSACTION',
          detectionMechanism: 'DETERMINISTIC_DETECTION',
          severity: isCriticalTx ? 'critical' : 'warning',
          title: `Abnormal Single Outflow: ${t.description || 'Transaction'}`,
          explanation: `A single debit of ${formatCurrency(amt, currency)} accounts for ${shareOfMonthlySpend.toFixed(0)}% of total monthly spend in ${reportingAnchorMonth}.`,
          supportingData: {
            primaryMetric: `Transaction Share: ${shareOfMonthlySpend.toFixed(0)}% of Month`,
            observedValue: formatCurrency(amt, currency),
            thresholdValue: `${thresholds.abnormalTransactionPercent}% of monthly outflow`,
            variancePercent: shareOfMonthlySpend,
            affectedAmount: amt,
            currency,
            evidenceItems: [
              `Transaction: "${t.description}" (${t.transaction_date})`,
              `Amount: ${formatCurrency(amt, currency)}`,
              `Category: ${t.category || 'Uncategorized'}`,
              `Month Outflow: ${formatCurrency(m0TotalOutflow, currency)}`,
            ],
          },
          affectedPeriod: t.transaction_date,
          suggestedAction:
            'Inspect invoice and approval documentation to ensure policy compliance and ledger categorization accuracy.',
          status: 'active',
          createdAt: new Date().toISOString(),
          category: t.category,
          actionType: 'view_transactions',
        });
      }
    }
  }

  // Deduplicate and rank by severity (critical -> warning -> info)
  const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const seenKeys = new Set<string>();
  const deduplicated: RiskAlert[] = [];

  for (const alert of alerts) {
    const key = `${alert.ruleId}-${alert.category || 'workspace'}-${alert.affectedPeriod}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicated.push(alert);
    }
  }

  deduplicated.sort((a, b) => (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99));

  return deduplicated;
}
