import { Transaction, CashFlowProjection, ProjectionMonth } from '@/types/finance';
import { calculateCashOnHand, calculateRunway, formatCurrency } from './calculator';
import { getReportingAnchorAndCompletedMonths, getMonthlyTotalsMap } from './financial-health';

/**
 * Returns next calendar month in YYYY-MM format.
 */
export function getNextMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Formats a YYYY-MM string into a human-readable abbreviation e.g. "Jan '26"
 */
export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const mIdx = parseInt(monthStr, 10) - 1;
  const shortYear = yearStr.slice(-2);
  return `${monthNames[mIdx]} '${shortYear}`;
}

/**
 * Generates verified historical cumulative cash flow trajectory and deterministic forecast.
 */
export function generateCashFlowProjection(
  transactions: Transaction[],
  startingBalance?: number,
  forecastMonthsCount: number = 6,
  currency: string = 'USD'
): CashFlowProjection {
  const activeTxs = transactions.filter((t) => t.status !== 'failed');
  const currentCash = calculateCashOnHand(activeTxs, startingBalance);

  if (activeTxs.length === 0) {
    return {
      points: [],
      currentCash,
      projectedRunway: 0,
      monthlyNetBurn: 0,
      status: 'insufficient_data',
      forecastMethodology: 'No transaction data available to plot cash trajectory.',
      hasSufficientData: false,
    };
  }

  const { reportingAnchorMonth, completedMonths, k } = getReportingAnchorAndCompletedMonths(activeTxs);

  if (!reportingAnchorMonth) {
    return {
      points: [],
      currentCash,
      projectedRunway: 0,
      monthlyNetBurn: 0,
      status: 'insufficient_data',
      forecastMethodology: 'Undefined reporting anchor.',
      hasSufficientData: false,
    };
  }

  const { inflows, outflows } = getMonthlyTotalsMap(activeTxs);

  // Find earliest transaction month
  let minMonth = activeTxs[0].transaction_date.substring(0, 7);
  for (const t of activeTxs) {
    const m = t.transaction_date.substring(0, 7);
    if (m < minMonth) minMonth = m;
  }

  // 1. Build Historical Calendar Months from minMonth through reportingAnchorMonth
  const historicalMonthKeys: string[] = [];
  let curr = minMonth;
  while (curr <= reportingAnchorMonth) {
    historicalMonthKeys.push(curr);
    curr = getNextMonthKey(curr);
  }

  // 2. Compute historical cumulative points
  const points: ProjectionMonth[] = [];
  const effectiveBaseline = typeof startingBalance === 'number' ? startingBalance : 1240000;
  let cumulative = effectiveBaseline;

  for (const mKey of historicalMonthKeys) {
    const mIn = inflows.get(mKey) || 0;
    const mOut = outflows.get(mKey) || 0;
    const netFlow = mIn - mOut;
    cumulative += netFlow;

    if (mKey === reportingAnchorMonth) {
      // Single boundary point representing current verified cash position
      points.push({
        month: `${formatMonthLabel(mKey)} (Current)`,
        actual: Math.max(0, currentCash),
        isCurrent: true,
        isForecast: false,
        netFlow,
      });
    } else {
      // Historical actual point
      points.push({
        month: formatMonthLabel(mKey),
        actual: Math.max(0, cumulative),
        isCurrent: false,
        isForecast: false,
        netFlow,
      });
    }
  }

  // 3. Evaluate completed months burn baseline
  // If k = 0, forecast is NOT computable (do not treat missing burn as 0 burn!)
  if (k === 0) {
    return {
      points,
      currentCash,
      projectedRunway: 0,
      monthlyNetBurn: 0,
      status: 'insufficient_data',
      forecastMethodology: 'Insufficient historical data (requires at least 1 completed month before current anchor month).',
      hasSufficientData: false,
    };
  }

  // Average Monthly Net Burn across completed months (empty months contribute 0)
  let totalNetBurn = 0;
  for (const m of completedMonths) {
    const mOut = outflows.get(m) || 0;
    const mIn = inflows.get(m) || 0;
    totalNetBurn += Math.max(0, mOut - mIn);
  }
  const averageNetBurn = totalNetBurn / k;
  const isCashFlowPositive = averageNetBurn <= 0;
  const { runwayMonths } = calculateRunway(currentCash, averageNetBurn);

  // 4. Generate deterministic forecast points M+1 through M+6
  let nextForecastMonth = getNextMonthKey(reportingAnchorMonth);

  for (let t = 1; t <= forecastMonthsCount; t++) {
    if (isCashFlowPositive) {
      // Valid flat forecast at current cash when operating at zero net burn / profitable
      points.push({
        month: formatMonthLabel(nextForecastMonth),
        forecast: currentCash,
        upperBand: currentCash,
        lowerBand: currentCash,
        isCurrent: false,
        isForecast: true,
      });
    } else {
      // Deterministic linear extrapolation with +/- 10% operational variance cone
      const baseForecast = Math.max(0, Math.round(currentCash - t * averageNetBurn));
      const upperBand = Math.max(0, Math.round(currentCash - t * averageNetBurn * 0.9));
      const lowerBand = Math.max(0, Math.round(currentCash - t * averageNetBurn * 1.1));

      points.push({
        month: formatMonthLabel(nextForecastMonth),
        forecast: baseForecast,
        upperBand,
        lowerBand,
        isCurrent: false,
        isForecast: true,
      });
    }
    nextForecastMonth = getNextMonthKey(nextForecastMonth);
  }

  return {
    points,
    currentCash,
    projectedRunway: runwayMonths,
    monthlyNetBurn: Math.round(averageNetBurn),
    status: 'active',
    forecastMethodology: isCashFlowPositive
      ? 'Cash-flow positive baseline: projected flat cash trajectory under current operational margins.'
      : `Linear projection based on 3-month trailing net burn (${formatCurrency(averageNetBurn, currency)}/mo) with ±10% operational variance envelope.`,
    hasSufficientData: true,
  };
}
