import type {
  Transaction,
  Workspace,
  ScenarioAssumptions,
  ScenarioBaselineMetrics,
  ScenarioProjectedMetrics,
  ScenarioDeltaMetrics,
  MonthlyTrajectoryPoint,
  ScenarioAnalysisResult,
  ScenarioMethodologyStep,
  SavedScenarioModel,
} from '@/types/finance';

export type {
  ScenarioAssumptions,
  ScenarioBaselineMetrics,
  ScenarioProjectedMetrics,
  ScenarioDeltaMetrics,
  MonthlyTrajectoryPoint,
  ScenarioAnalysisResult,
  ScenarioMethodologyStep,
  SavedScenarioModel,
};


import { calculateCashOnHand, formatCurrency } from './calculator';
import { getReportingAnchorAndCompletedMonths, getMonthlyTotalsMap } from './financial-health';

export const DEFAULT_SCENARIO_ASSUMPTIONS: ScenarioAssumptions = {
  monthlyExpensesDelta: 0,
  revenueGrowthRateMoM: 0,
  additionalMonthlyRevenue: 0,
  hiringCount: 0,
  hiringCostPerRole: 10000,
  marketingSpendDelta: 0,
  infrastructureSpendDelta: 0,
};

/**
 * Derives authoritative baseline financial metrics from verified ledger transactions
 */
export function deriveBaselineFromTransactions(
  transactions: Transaction[],
  workspace: Workspace
): ScenarioBaselineMetrics {
  const activeTxs = transactions.filter((t) => t.status !== 'failed');
  const cash = calculateCashOnHand(activeTxs, workspace.starting_cash);
  const currency = workspace.currency || 'USD';

  if (activeTxs.length === 0) {
    return {
      cash,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      monthlyNetBurn: 0,
      runwayMonths: 999,
      isCashFlowPositive: true,
      currency,
    };
  }

  const { completedMonths, k } = getReportingAnchorAndCompletedMonths(activeTxs);
  const { inflows, outflows } = getMonthlyTotalsMap(activeTxs);

  let baselineMonthlyRevenue = 0;
  let baselineMonthlyExpenses = 0;

  if (k > 0) {
    // Average across completed months window
    let totalInflow = 0;
    let totalOutflow = 0;
    for (const m of completedMonths) {
      totalInflow += inflows.get(m) || 0;
      totalOutflow += outflows.get(m) || 0;
    }
    baselineMonthlyRevenue = Math.round(totalInflow / k);
    baselineMonthlyExpenses = Math.round(totalOutflow / k);
  } else {
    // Fallback: sum of all active transactions if no completed months boundary yet
    let totalInflow = 0;
    let totalOutflow = 0;
    for (const t of activeTxs) {
      const amt = Number(t.amount || 0);
      if (t.transaction_type === 'income') totalInflow += amt;
      else if (t.transaction_type === 'expense') totalOutflow += amt;
    }
    baselineMonthlyRevenue = Math.round(totalInflow);
    baselineMonthlyExpenses = Math.round(totalOutflow);
  }

  const monthlyNetBurn = Math.max(0, baselineMonthlyExpenses - baselineMonthlyRevenue);
  const isCashFlowPositive = monthlyNetBurn <= 0;
  const runwayMonths = isCashFlowPositive
    ? 999
    : Math.round((cash / monthlyNetBurn) * 10) / 10;

  return {
    cash,
    monthlyRevenue: baselineMonthlyRevenue,
    monthlyExpenses: baselineMonthlyExpenses,
    monthlyNetBurn,
    runwayMonths,
    isCashFlowPositive,
    currency,
  };
}

/**
 * Deterministic Scenario Analysis Engine
 * Calculates projected net burn, runway, and cash trajectory based on explicit user adjustments.
 */
export function calculateScenarioModel(
  baseline: ScenarioBaselineMetrics,
  customAssumptions: Partial<ScenarioAssumptions> = {}
): ScenarioAnalysisResult {
  const assumptions: ScenarioAssumptions = {
    ...DEFAULT_SCENARIO_ASSUMPTIONS,
    ...customAssumptions,
  };

  const currency = baseline.currency || 'USD';

  // 1. Calculate incremental cost items
  const hiringTotalCost = assumptions.hiringCount * assumptions.hiringCostPerRole;
  const totalIncrementalCost =
    assumptions.monthlyExpensesDelta +
    hiringTotalCost +
    assumptions.marketingSpendDelta +
    assumptions.infrastructureSpendDelta;

  // 2. Calculate incremental revenue items
  const growthRevenue = Math.round(
    baseline.monthlyRevenue * (assumptions.revenueGrowthRateMoM / 100)
  );
  const totalIncrementalRevenue =
    growthRevenue + assumptions.additionalMonthlyRevenue;

  // 3. Projected metrics
  const projectedExpenses = Math.max(
    0,
    baseline.monthlyExpenses + totalIncrementalCost
  );
  const projectedRevenue = Math.max(
    0,
    baseline.monthlyRevenue + totalIncrementalRevenue
  );
  const projectedNetBurn = Math.max(0, projectedExpenses - projectedRevenue);
  const projectedIsCashFlowPositive = projectedNetBurn <= 0;
  const projectedRunway = projectedIsCashFlowPositive
    ? 999
    : Math.round((baseline.cash / projectedNetBurn) * 10) / 10;

  const projected: ScenarioProjectedMetrics = {
    monthlyRevenue: projectedRevenue,
    monthlyExpenses: projectedExpenses,
    monthlyNetBurn: projectedNetBurn,
    runwayMonths: projectedRunway,
    isCashFlowPositive: projectedIsCashFlowPositive,
    totalIncrementalCost,
    totalIncrementalRevenue,
  };

  // 4. Delta calculations
  const revenueDelta = projectedRevenue - baseline.monthlyRevenue;
  const expensesDelta = projectedExpenses - baseline.monthlyExpenses;
  const netBurnDelta = projectedNetBurn - baseline.monthlyNetBurn;

  let runwayDeltaMonths: number | null = null;
  let runwayImpactDescription = '';

  if (baseline.isCashFlowPositive && projectedIsCashFlowPositive) {
    runwayDeltaMonths = 0;
    runwayImpactDescription = 'Maintains self-sustaining cash flow positive operation.';
  } else if (baseline.isCashFlowPositive && !projectedIsCashFlowPositive) {
    runwayDeltaMonths = null;
    runwayImpactDescription = `Shifts from cash-flow positive to cash burning (${projectedRunway.toFixed(1)} months runway remaining).`;
  } else if (!baseline.isCashFlowPositive && projectedIsCashFlowPositive) {
    runwayDeltaMonths = null;
    runwayImpactDescription = 'Eliminates cash burn entirely, extending runway to indefinite (self-sustaining).';
  } else {
    // Both are finite runways
    runwayDeltaMonths = Math.round((projectedRunway - baseline.runwayMonths) * 10) / 10;
    if (runwayDeltaMonths > 0) {
      runwayImpactDescription = `Extends runway by +${runwayDeltaMonths.toFixed(1)} months (${baseline.runwayMonths.toFixed(1)}m → ${projectedRunway.toFixed(1)}m).`;
    } else if (runwayDeltaMonths < 0) {
      runwayImpactDescription = `Compresses runway by ${Math.abs(runwayDeltaMonths).toFixed(1)} months (${baseline.runwayMonths.toFixed(1)}m → ${projectedRunway.toFixed(1)}m).`;
    } else {
      runwayImpactDescription = `No net change in runway (${projectedRunway.toFixed(1)} months).`;
    }
  }

  const delta: ScenarioDeltaMetrics = {
    revenueDelta,
    expensesDelta,
    netBurnDelta,
    runwayDeltaMonths,
    runwayImpactDescription,
  };

  // 5. 12-Month Deterministic Trajectory
  const trajectory: MonthlyTrajectoryPoint[] = [];
  let baseRunningCash = baseline.cash;
  let scenRunningCash = baseline.cash;

  for (let m = 1; m <= 12; m++) {
    // Baseline monthly cash delta
    const baseNet = baseline.monthlyRevenue - baseline.monthlyExpenses;
    baseRunningCash = Math.max(0, baseRunningCash + baseNet);

    // Scenario monthly cash delta
    const scenNet = projectedRevenue - projectedExpenses;
    scenRunningCash = Math.max(0, scenRunningCash + scenNet);

    trajectory.push({
      monthIndex: m,
      monthLabel: `Month +${m}`,
      baselineCash: Math.round(baseRunningCash),
      scenarioCash: Math.round(scenRunningCash),
      deltaCash: Math.round(scenRunningCash - baseRunningCash),
    });
  }

  // 6. Methodology Steps
  const methodologySteps: ScenarioMethodologyStep[] = [
    {
      step: '1. Baseline Derivation',
      formula: `Net Burn = max(0, Expenses [${formatCurrency(baseline.monthlyExpenses, currency)}] - Revenue [${formatCurrency(baseline.monthlyRevenue, currency)}]) = ${formatCurrency(baseline.monthlyNetBurn, currency)}/mo`,
      explanation: `Calculated from verified ledger history. Baseline runway is Cash [${formatCurrency(baseline.cash, currency)}] / Net Burn = ${baseline.runwayMonths === 999 ? '∞' : `${baseline.runwayMonths.toFixed(1)} months`}.`,
    },
    {
      step: '2. Expense Adjustments',
      formula: `ΔExpenses = Ops (${formatCurrency(assumptions.monthlyExpensesDelta, currency)}) + Hiring (${assumptions.hiringCount} × ${formatCurrency(assumptions.hiringCostPerRole, currency)} = ${formatCurrency(hiringTotalCost, currency)}) + Mktg (${formatCurrency(assumptions.marketingSpendDelta, currency)}) + Cloud (${formatCurrency(assumptions.infrastructureSpendDelta, currency)}) = ${formatCurrency(totalIncrementalCost, currency)}`,
      explanation: `Total planned monthly operational cost increases or decreases applied to baseline expenses.`,
    },
    {
      step: '3. Revenue Adjustments',
      formula: `ΔRevenue = Growth (${assumptions.revenueGrowthRateMoM}% MoM = ${formatCurrency(growthRevenue, currency)}) + Direct Contracts (${formatCurrency(assumptions.additionalMonthlyRevenue, currency)}) = ${formatCurrency(totalIncrementalRevenue, currency)}`,
      explanation: `Deterministic top-line adjustments applied to baseline monthly revenue.`,
    },
    {
      step: '4. Projected Net Burn & Runway',
      formula: `Projected Burn = max(0, ${formatCurrency(projectedExpenses, currency)} - ${formatCurrency(projectedRevenue, currency)}) = ${formatCurrency(projectedNetBurn, currency)}/mo`,
      explanation: projectedNetBurn > 0
        ? `Projected runway = ${formatCurrency(baseline.cash, currency)} / ${formatCurrency(projectedNetBurn, currency)} = ${projectedRunway.toFixed(1)} months.`
        : `Revenue exceeds expenses. The company is projected to be cash-flow positive (infinite runway).`,
    },
    {
      step: '5. Deterministic Delta',
      formula: `ΔBurn = ${formatCurrency(netBurnDelta, currency)}/mo | ΔRunway = ${runwayDeltaMonths !== null ? `${runwayDeltaMonths > 0 ? '+' : ''}${runwayDeltaMonths.toFixed(1)} mos` : 'N/A'}`,
      explanation: runwayImpactDescription,
    },
  ];

  return {
    baseline,
    scenario: projected,
    delta,
    trajectory,
    assumptions,
    methodology: {
      title: 'Deterministic Scenario Calculation Methodology',
      steps: methodologySteps,
    },
  };
}

/**
 * Packages a session-local saved what-if scenario model.
 * Models remain in-memory and are never written to the ledger database.
 */
export function createSavedScenarioModel(
  name: string,
  assumptions: ScenarioAssumptions
): SavedScenarioModel {
  return {
    id: `scen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Untitled Scenario',
    assumptions: {
      ...DEFAULT_SCENARIO_ASSUMPTIONS,
      ...assumptions,
    },
    createdAt: new Date().toLocaleDateString(),
  };
}

/**
 * Defensively restores complete scenario assumptions from a saved scenario model or raw assumptions payload.
 * Guarantees every single scenario lever is restored as a valid number with defaults for any missing properties.
 */
export function restoreScenarioAssumptions(
  saved: SavedScenarioModel | { assumptions?: Partial<ScenarioAssumptions> } | Partial<ScenarioAssumptions>
): ScenarioAssumptions {
  if (!saved || typeof saved !== 'object') {
    return { ...DEFAULT_SCENARIO_ASSUMPTIONS };
  }

  // Handle either SavedScenarioModel, wrapper with assumptions property, or direct assumptions object
  const raw: Partial<ScenarioAssumptions> =
    'assumptions' in saved && saved.assumptions && typeof saved.assumptions === 'object'
      ? saved.assumptions
      : (saved as Partial<ScenarioAssumptions>);

  return {
    monthlyExpensesDelta: Number.isFinite(Number(raw.monthlyExpensesDelta))
      ? Number(raw.monthlyExpensesDelta)
      : DEFAULT_SCENARIO_ASSUMPTIONS.monthlyExpensesDelta,
    revenueGrowthRateMoM: Number.isFinite(Number(raw.revenueGrowthRateMoM))
      ? Number(raw.revenueGrowthRateMoM)
      : DEFAULT_SCENARIO_ASSUMPTIONS.revenueGrowthRateMoM,
    additionalMonthlyRevenue: Number.isFinite(Number(raw.additionalMonthlyRevenue))
      ? Number(raw.additionalMonthlyRevenue)
      : DEFAULT_SCENARIO_ASSUMPTIONS.additionalMonthlyRevenue,
    hiringCount: Number.isFinite(Number(raw.hiringCount))
      ? Math.max(0, Math.round(Number(raw.hiringCount)))
      : DEFAULT_SCENARIO_ASSUMPTIONS.hiringCount,
    hiringCostPerRole: Number.isFinite(Number(raw.hiringCostPerRole))
      ? Math.max(0, Number(raw.hiringCostPerRole))
      : DEFAULT_SCENARIO_ASSUMPTIONS.hiringCostPerRole,
    marketingSpendDelta: Number.isFinite(Number(raw.marketingSpendDelta))
      ? Number(raw.marketingSpendDelta)
      : DEFAULT_SCENARIO_ASSUMPTIONS.marketingSpendDelta,
    infrastructureSpendDelta: Number.isFinite(Number(raw.infrastructureSpendDelta))
      ? Number(raw.infrastructureSpendDelta)
      : DEFAULT_SCENARIO_ASSUMPTIONS.infrastructureSpendDelta,
  };
}
