import { Transaction, Workspace, MetricExplanation } from '@/types/finance';
import {
  calculateCashOnHand,
  calculateTotalInflow,
  calculateTotalOutflow,
  calculateMonthlyNetBurn,
  calculateRunway,
  formatCurrency,
  getCurrencySymbol,
} from './calculator';
import {
  getReportingAnchorAndCompletedMonths,
  getMonthlyTotalsMap,
} from './financial-health';
import { formatMonthLabel } from './projections';

/**
 * Returns deterministic step-by-step arithmetic explanations for the 4 core metrics.
 */
export function getMetricExplanation(
  key: 'cash' | 'burn' | 'runway' | 'growth',
  transactions: Transaction[],
  workspace: Workspace
): MetricExplanation {
  const activeTxs = transactions.filter((t) => t.status !== 'failed');
  const currency = workspace.currency || 'USD';
  const startingCash = typeof workspace.starting_cash === 'number' ? workspace.starting_cash : 1240000;
  const currentCash = calculateCashOnHand(activeTxs, startingCash);
  const totalInflow = calculateTotalInflow(activeTxs);
  const totalOutflow = calculateTotalOutflow(activeTxs);

  const { reportingAnchorMonth, completedMonths, k } = getReportingAnchorAndCompletedMonths(activeTxs);
  const { inflows, outflows } = getMonthlyTotalsMap(activeTxs);

  if (key === 'cash') {
    const hasData = activeTxs.length > 0;
    return {
      key: 'cash',
      title: 'Cash on Hand',
      currentDisplay: formatCurrency(currentCash, currency),
      formula: 'Starting Cash Balance + Total Inflows - Total Outflows',
      formulaSteps: [
        { label: 'Starting Corporate Baseline Balance', value: formatCurrency(startingCash, currency) },
        { label: 'Total Verified Inflows (Inception to Date)', value: `+${formatCurrency(totalInflow, currency)}`, operation: '+' },
        { label: 'Total Verified Outflows (Inception to Date)', value: `-${formatCurrency(totalOutflow, currency)}`, operation: '-' },
        { label: 'Net Cash on Hand', value: formatCurrency(currentCash, currency), operation: '=' },
      ],
      methodology: 'Full-Horizon Verified Corporate Ledger Rollup',
      comparisonPeriod: hasData ? `Spans all verified transactions through ${reportingAnchorMonth}` : 'No transaction records',
      hasSufficientData: hasData,
    };
  }

  if (key === 'burn') {
    if (k === 0) {
      return {
        key: 'burn',
        title: 'Monthly Burn Rate',
        currentDisplay: 'Insufficient Data',
        formula: 'Sum of Monthly Operating Deficits ÷ Number of Completed Months',
        formulaSteps: [
          { label: 'Completed Historical Months Preceding Anchor', value: '0 months' },
          { label: 'Status', value: 'Requires at least 1 completed calendar month preceding anchor month to establish baseline burn.' },
        ],
        methodology: '3-Month Trailing Average Net Burn',
        burnMethodology: '3-Month Trailing Average Net Deficit',
        comparisonPeriod: '0 completed historical months',
        hasSufficientData: false,
        statusLabel: 'Insufficient Data',
      };
    }

    // Calculate monthly deficits across completed months
    let totalDeficit = 0;
    let totalGrossOutflow = 0;
    const steps: Array<{ label: string; value: string; operation?: string }> = [];

    for (let i = 0; i < completedMonths.length; i++) {
      const mKey = completedMonths[i];
      const mOut = outflows.get(mKey) || 0;
      const mIn = inflows.get(mKey) || 0;
      const mDeficit = Math.max(0, mOut - mIn);
      totalDeficit += mDeficit;
      totalGrossOutflow += mOut;

      steps.push({
        label: `${formatMonthLabel(mKey)} (Outflows: ${formatCurrency(mOut, currency)}, Inflows: ${formatCurrency(mIn, currency)})`,
        value: `Net Deficit: ${formatCurrency(mDeficit, currency)}`,
        operation: i > 0 ? '+' : undefined,
      });
    }

    const averageNetBurn = Math.round(totalDeficit / k);
    const averageGrossOutflow = Math.round(totalGrossOutflow / k);

    steps.push({
      label: `Total Completed Deficits (${k} month${k > 1 ? 's' : ''})`,
      value: formatCurrency(totalDeficit, currency),
      operation: '=',
    });
    steps.push({
      label: `Average Monthly Net Burn (÷ ${k})`,
      value: `${formatCurrency(averageNetBurn, currency)} / mo`,
      operation: '=',
    });
    steps.push({
      label: `Average Monthly Gross Outflow (for comparison)`,
      value: `${formatCurrency(averageGrossOutflow, currency)} / mo`,
    });

    return {
      key: 'burn',
      title: 'Monthly Burn Rate',
      currentDisplay: `${formatCurrency(averageNetBurn, currency)} / mo`,
      formula: 'Sum of Monthly Net Deficits (max(0, Outflows - Inflows)) ÷ k Completed Months',
      formulaSteps: steps,
      methodology: '3-Month Trailing Average Net Burn',
      burnMethodology: `${k}-Month Trailing Average Net Deficit (Gross: ${formatCurrency(averageGrossOutflow, currency)}/mo)`,
      comparisonPeriod: `Trailing ${k} completed calendar month${k > 1 ? 's' : ''} (${completedMonths.map(formatMonthLabel).reverse().join(', ')})`,
      hasSufficientData: true,
    };
  }

  if (key === 'runway') {
    if (k === 0) {
      return {
        key: 'runway',
        title: 'Estimated Runway',
        currentDisplay: 'Insufficient Data',
        formula: 'Current Cash on Hand ÷ Average Monthly Net Burn',
        formulaSteps: [
          { label: 'Current Cash', value: formatCurrency(currentCash, currency) },
          { label: 'Average Monthly Net Burn', value: 'Undefined (0 completed historical months)' },
          { label: 'Result', value: 'Requires at least 1 completed calendar month to establish a burn denominator.' },
        ],
        methodology: 'Capital Longevity Model (Cash ÷ Trailing Net Burn)',
        comparisonPeriod: '0 completed historical months',
        hasSufficientData: false,
        statusLabel: 'Insufficient Data',
      };
    }

    const averageNetBurn = calculateMonthlyNetBurn(activeTxs);
    const { runwayMonths, display, isCashFlowPositive } = calculateRunway(currentCash, averageNetBurn);

    const steps: Array<{ label: string; value: string; operation?: string }> = [
      { label: 'Current Verified Cash on Hand', value: formatCurrency(currentCash, currency) },
      { label: `Average Monthly Net Burn (${k}-mo trailing baseline)`, value: `${formatCurrency(averageNetBurn, currency)} / mo`, operation: '÷' },
    ];

    if (isCashFlowPositive) {
      steps.push({
        label: 'Operating Posture',
        value: 'Net Cash-Flow Positive (Average monthly inflows cover operating outflows)',
        operation: '=',
      });
      steps.push({
        label: 'Calculated Runway',
        value: 'Infinite / Self-Sustaining under current operating margins',
        operation: '=',
      });
    } else {
      steps.push({
        label: 'Calculated Runway',
        value: `${runwayMonths.toFixed(1)} Months (${display})`,
        operation: '=',
      });
    }

    return {
      key: 'runway',
      title: 'Estimated Runway',
      currentDisplay: display,
      formula: 'Current Cash on Hand ÷ Average Monthly Net Burn',
      formulaSteps: steps,
      methodology: 'Deterministic Capital Longevity Ratio',
      burnMethodology: `${k}-Month Trailing Average Net Burn (${formatCurrency(averageNetBurn, currency)}/mo)`,
      comparisonPeriod: `Based on trailing ${k} completed calendar month${k > 1 ? 's' : ''}`,
      hasSufficientData: true,
    };
  }

  // Key === 'growth'
  const m1 = completedMonths[0]; // M-1
  const m2 = completedMonths[1]; // M-2
  const rev1 = m1 ? inflows.get(m1) || 0 : 0;
  const rev2 = m2 ? inflows.get(m2) || 0 : 0;

  if (k < 2) {
    return {
      key: 'growth',
      title: 'MoM Revenue Growth',
      currentDisplay: 'Requires 2 Completed Months',
      formula: '(Completed Month M-1 Revenue - Completed Month M-2 Revenue) ÷ M-2 Revenue × 100',
      formulaSteps: [
        { label: 'Available Completed Historical Months', value: `${k} month (need 2)` },
        { label: 'Status', value: 'MoM comparison requires at least 2 fully completed calendar months.' },
      ],
      methodology: 'Closed-Calendar Month-over-Month Growth',
      comparisonPeriod: 'Insufficient historical periods',
      hasSufficientData: false,
      statusLabel: 'Requires 2 Completed Months',
    };
  }

  if (rev1 === 0 && rev2 === 0) {
    return {
      key: 'growth',
      title: 'MoM Revenue Growth',
      currentDisplay: `Pre-Revenue (${getCurrencySymbol(currency)}0 Inflows)`,
      formula: '(Revenue M-1 - Revenue M-2) ÷ Revenue M-2 × 100',
      formulaSteps: [
        { label: `${formatMonthLabel(m1)} (M-1) Revenue`, value: formatCurrency(0, currency) },
        { label: `${formatMonthLabel(m2)} (M-2) Revenue`, value: formatCurrency(0, currency) },
        { label: 'State', value: 'Zero verified customer revenues recorded across completed periods.' },
      ],
      methodology: 'Closed-Calendar Month-over-Month Growth',
      comparisonPeriod: `${formatMonthLabel(m1)} vs ${formatMonthLabel(m2)}`,
      hasSufficientData: true,
      statusLabel: 'Pre-Revenue',
    };
  }

  if (rev2 === 0 && rev1 > 0) {
    return {
      key: 'growth',
      title: 'MoM Revenue Growth',
      currentDisplay: 'First Revenue Logged',
      formula: '(Revenue M-1 - Revenue M-2) ÷ Revenue M-2 × 100',
      formulaSteps: [
        { label: `${formatMonthLabel(m2)} (M-2) Prior Revenue`, value: formatCurrency(0, currency) },
        { label: `${formatMonthLabel(m1)} (M-1) Current Revenue`, value: formatCurrency(rev1, currency) },
        { label: 'Status', value: 'First positive revenue period logged; division by zero prevented.' },
      ],
      methodology: 'Closed-Calendar Month-over-Month Growth',
      comparisonPeriod: `${formatMonthLabel(m1)} vs ${formatMonthLabel(m2)}`,
      hasSufficientData: true,
      statusLabel: 'First Revenue Logged',
    };
  }

  const delta = rev1 - rev2;
  const growthPercent = (delta / rev2) * 100;
  const growthDisplay = `${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}%`;

  return {
    key: 'growth',
    title: 'MoM Revenue Growth',
    currentDisplay: growthDisplay,
    formula: '(Revenue M-1 - Revenue M-2) ÷ Revenue M-2 × 100',
    formulaSteps: [
      { label: `${formatMonthLabel(m1)} (M-1) Revenue`, value: formatCurrency(rev1, currency) },
      { label: `${formatMonthLabel(m2)} (M-2) Prior Revenue`, value: formatCurrency(rev2, currency), operation: '-' },
      { label: 'Net Revenue Delta', value: `${delta >= 0 ? '+' : ''}${formatCurrency(delta, currency)}`, operation: '=' },
      { label: 'MoM Growth Rate (Delta ÷ Prior)', value: growthDisplay, operation: '=' },
    ],
    methodology: 'Closed-Calendar Month-over-Month Growth',
    comparisonPeriod: `${formatMonthLabel(m1)} vs ${formatMonthLabel(m2)}`,
    hasSufficientData: true,
  };
}
