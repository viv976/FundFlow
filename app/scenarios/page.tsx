'use client';

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import {
  calculateScenarioModel,
  DEFAULT_SCENARIO_ASSUMPTIONS,
  createSavedScenarioModel,
  restoreScenarioAssumptions,
} from '@/lib/finance/scenario-engine';
import {
  ScenarioAssumptions,
  ScenarioMethodologyStep,
  MonthlyTrajectoryPoint,
  SavedScenarioModel,
} from '@/types/finance';
import { formatCurrency } from '@/lib/finance/calculator';



export default function ScenariosPage() {
  const { scenarioBaseline, workspace } = useFinance();
  const currency = workspace.currency || 'USD';

  // In-memory scenario adjustments (never persisted to financial ledger)
  const [assumptions, setAssumptions] = useState<ScenarioAssumptions>(DEFAULT_SCENARIO_ASSUMPTIONS);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioModel[]>([]);
  const [scenarioNameInput, setScenarioNameInput] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  // Compute deterministic scenario model
  const analysis = useMemo(() => {
    return calculateScenarioModel(scenarioBaseline, assumptions);
  }, [scenarioBaseline, assumptions]);

  const handleReset = () => {
    setAssumptions({ ...DEFAULT_SCENARIO_ASSUMPTIONS });
  };

  const handleSaveScenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioNameInput.trim()) return;
    const newModel = createSavedScenarioModel(scenarioNameInput, assumptions);
    setSavedScenarios((prev) => [newModel, ...prev]);
    setScenarioNameInput('');
    setShowSaveModal(false);
  };

  const loadSavedScenario = (saved: SavedScenarioModel | ScenarioAssumptions) => {
    const restored = restoreScenarioAssumptions(saved);
    setAssumptions(restored);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isModified =
    assumptions.monthlyExpensesDelta !== 0 ||
    assumptions.revenueGrowthRateMoM !== 0 ||
    assumptions.additionalMonthlyRevenue !== 0 ||
    assumptions.hiringCount !== 0 ||
    assumptions.hiringCostPerRole !== DEFAULT_SCENARIO_ASSUMPTIONS.hiringCostPerRole ||
    assumptions.marketingSpendDelta !== 0 ||
    assumptions.infrastructureSpendDelta !== 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-mono-data uppercase tracking-wider text-secondary bg-secondary/10 border border-secondary/20 px-2.5 py-0.5 rounded font-bold">
              Deterministic Simulation
            </span>
            <span className="text-xs text-on-surface-variant font-medium">
              • 0% Real Ledger Impact
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
            Scenario Planning Engine
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Evaluate hiring, marketing, infrastructure, and revenue sensitivities with mathematical precision.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {isModified && (
            <button
              onClick={handleReset}
              className="px-4 py-2.5 border border-outline-variant rounded-xl bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Reset Scenario</span>
            </button>
          )}

          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
            <span>Save Model</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Comparison: BASELINE vs SCENARIO vs DELTA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: BASELINE */}
        <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-outline-variant/60 shadow-xs relative">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono-data uppercase font-bold tracking-wider text-on-surface-variant">
              1. Authoritative Baseline
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono-data font-semibold">
              Verified Ledger
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-[11px] text-on-surface-variant font-medium block">Cash on Hand</span>
              <div className="text-2xl font-bold font-mono-data text-on-surface">
                {formatCurrency(analysis.baseline.cash, currency)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant/40">
              <div>
                <span className="text-[10px] text-on-surface-variant block">Monthly Net Burn</span>
                <span className="text-sm font-semibold font-mono-data text-on-surface">
                  {formatCurrency(analysis.baseline.monthlyNetBurn, currency)}/mo
                </span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block">Baseline Runway</span>
                <span className="text-sm font-semibold font-mono-data text-on-surface">
                  {analysis.baseline.isCashFlowPositive ? 'Infinite (CF+)' : `${analysis.baseline.runwayMonths.toFixed(1)} mos`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-on-surface-variant pt-2 border-t border-outline-variant/40">
              <div>
                <span className="text-[10px] block">Revenue:</span>
                <span className="font-mono-data font-medium text-on-surface">
                  {formatCurrency(analysis.baseline.monthlyRevenue, currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] block">Expenses:</span>
                <span className="font-mono-data font-medium text-on-surface">
                  {formatCurrency(analysis.baseline.monthlyExpenses, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: SCENARIO */}
        <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-secondary/40 shadow-xs relative">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono-data uppercase font-bold tracking-wider text-secondary">
              2. Simulated Scenario
            </span>
            <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary text-[10px] font-mono-data font-bold">
              Adjusted Model
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-[11px] text-on-surface-variant font-medium block">Projected Net Burn</span>
              <div className="text-2xl font-bold font-mono-data text-on-surface">
                {formatCurrency(analysis.scenario.monthlyNetBurn, currency)}
                <span className="text-xs font-normal text-on-surface-variant">/mo</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant/40">
              <div>
                <span className="text-[10px] text-on-surface-variant block">Projected Runway</span>
                <span className="text-sm font-semibold font-mono-data text-on-surface">
                  {analysis.scenario.isCashFlowPositive ? 'Infinite (CF+)' : `${analysis.scenario.runwayMonths.toFixed(1)} mos`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block">Status</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded inline-block ${
                  analysis.scenario.isCashFlowPositive
                    ? 'bg-secondary/20 text-secondary'
                    : analysis.scenario.runwayMonths < 3
                    ? 'bg-error/20 text-error'
                    : 'bg-tertiary/20 text-tertiary-fixed-dim'
                }`}>
                  {analysis.scenario.isCashFlowPositive ? 'Self-Sustaining' : analysis.scenario.runwayMonths < 3 ? 'Critical' : 'Operational'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-on-surface-variant pt-2 border-t border-outline-variant/40">
              <div>
                <span className="text-[10px] block">New Revenue:</span>
                <span className="font-mono-data font-medium text-on-surface">
                  {formatCurrency(analysis.scenario.monthlyRevenue, currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] block">New Expenses:</span>
                <span className="font-mono-data font-medium text-on-surface">
                  {formatCurrency(analysis.scenario.monthlyExpenses, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: DELTA & IMPACT */}
        <div className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border shadow-xs relative ${
          analysis.delta.netBurnDelta > 0
            ? 'bg-tertiary-container/10 border-tertiary-fixed-dim/30'
            : 'bg-secondary-container/10 border-secondary-fixed/30'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono-data uppercase font-bold tracking-wider text-on-surface">
              3. Deterministic Delta
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px] font-mono-data font-bold">
              Net Variance
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-[11px] text-on-surface-variant font-medium block">Monthly Net Burn Impact</span>
              <div className={`text-2xl font-bold font-mono-data ${
                analysis.delta.netBurnDelta > 0 ? 'text-error' : analysis.delta.netBurnDelta < 0 ? 'text-secondary' : 'text-on-surface'
              }`}>
                {analysis.delta.netBurnDelta > 0 ? '+' : ''}
                {formatCurrency(analysis.delta.netBurnDelta, currency)}
                <span className="text-xs font-normal text-on-surface-variant">/mo</span>
              </div>
            </div>

            <div className="pt-2 border-t border-outline-variant/40 space-y-1">
              <span className="text-[10px] text-on-surface-variant block font-medium">Runway Delta</span>
              <div className="text-sm font-semibold font-mono-data text-on-surface">
                {analysis.delta.runwayDeltaMonths !== null
                  ? `${analysis.delta.runwayDeltaMonths > 0 ? '+' : ''}${analysis.delta.runwayDeltaMonths.toFixed(1)} months`
                  : 'Regime Transition'}
              </div>
              <p className="text-[11px] text-on-surface-variant leading-snug">
                {analysis.delta.runwayImpactDescription}
              </p>
            </div>

            <div className="pt-2 border-t border-outline-variant/40 text-xs">
              <span className="text-[10px] text-on-surface-variant block">Total Monthly Cost Adjustment</span>
              <span className="font-mono-data font-medium text-on-surface">
                {analysis.scenario.totalIncrementalCost >= 0 ? '+' : ''}
                {formatCurrency(analysis.scenario.totalIncrementalCost, currency)}/mo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Assumption Controls */}
      <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-outline-variant/60 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/40 pb-4">
          <div>
            <h2 className="text-lg font-bold text-on-surface font-headline-md">
              Scenario Assumptions & Levers
            </h2>
            <p className="text-xs text-on-surface-variant">
              Adjust independent financial variables. Every modification calculates immediate mathematical effects without arbitrary assumptions.
            </p>
          </div>
          <button
            onClick={() => setShowMethodology(!showMethodology)}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">calculate</span>
            <span>{showMethodology ? 'Hide Methodology' : 'View Methodology'}</span>
          </button>
        </div>

        {/* Methodology Accordion */}
        {showMethodology && (
          <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-3 animate-fadeIn">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider font-mono-data">
              {analysis.methodology.title}
            </h4>
            <div className="space-y-2">
              {analysis.methodology.steps.map((step: ScenarioMethodologyStep, idx: number) => (
                <div key={idx} className="p-2.5 bg-surface-container-lowest rounded-lg border border-outline-variant/40 text-xs">
                  <div className="font-semibold text-on-surface font-headline-sm">{step.step}</div>
                  <div className="font-mono-data text-primary py-0.5 text-[11px]">{step.formula}</div>
                  <div className="text-on-surface-variant text-[11px]">{step.explanation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEVER 1: Monthly Operational Expenses */}
          <div className="space-y-2 p-4 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">account_balance</span>
                <span>General Operational Spend (Δ/mo)</span>
              </label>
              <span className="font-mono-data font-bold text-xs text-on-surface">
                {assumptions.monthlyExpensesDelta >= 0 ? '+' : ''}
                {formatCurrency(assumptions.monthlyExpensesDelta, currency)}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Operational overhead, administrative costs, or software tool subscriptions.
            </p>
            <input
              type="range"
              min={-50000}
              max={100000}
              step={1000}
              value={assumptions.monthlyExpensesDelta}
              onChange={(e) =>
                setAssumptions((prev: ScenarioAssumptions) => ({ ...prev, monthlyExpensesDelta: Number(e.target.value) }))
              }
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono-data text-on-surface-variant">
              <span>-$50K/mo</span>
              <span>Baseline ($0)</span>
              <span>+$100K/mo</span>
            </div>
          </div>

          {/* LEVER 2: Revenue Growth / Incremental Contract */}
          <div className="space-y-2 p-4 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-secondary">trending_up</span>
                <span>Revenue Growth Rate (MoM %)</span>
              </label>
              <span className="font-mono-data font-bold text-xs text-secondary">
                {assumptions.revenueGrowthRateMoM >= 0 ? '+' : ''}
                {assumptions.revenueGrowthRateMoM}% MoM
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Simulated compound expansion or contraction in top-line monthly customer receipts.
            </p>
            <input
              type="range"
              min={-50}
              max={100}
              step={1}
              value={assumptions.revenueGrowthRateMoM}
              onChange={(e) =>
                setAssumptions((prev: ScenarioAssumptions) => ({ ...prev, revenueGrowthRateMoM: Number(e.target.value) }))
              }
              className="w-full accent-secondary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono-data text-on-surface-variant">
              <span>-50% (Contracting)</span>
              <span>0% (Flat)</span>
              <span>+100% (Doubling)</span>
            </div>
          </div>

          {/* LEVER 3: Hiring & Headcount */}
          <div className="space-y-3 p-4 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-tertiary-fixed-dim">group_add</span>
                <span>New Hires Headcount</span>
              </label>
              <span className="font-mono-data font-bold text-xs text-on-surface">
                +{assumptions.hiringCount} Roles ({formatCurrency(assumptions.hiringCount * assumptions.hiringCostPerRole, currency)}/mo)
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Fully-burdened monthly compensation including salary, health benefits, and payroll taxes.
            </p>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={assumptions.hiringCount}
              onChange={(e) =>
                setAssumptions((prev: ScenarioAssumptions) => ({ ...prev, hiringCount: Number(e.target.value) }))
              }
              className="w-full accent-tertiary cursor-pointer"
            />
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <span className="text-[11px] text-on-surface-variant">Average Cost Per Role:</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono-data text-on-surface-variant">$</span>
                <input
                  type="number"
                  min={1000}
                  max={50000}
                  step={500}
                  value={assumptions.hiringCostPerRole}
                  onChange={(e) =>
                    setAssumptions((prev: ScenarioAssumptions) => ({
                      ...prev,
                      hiringCostPerRole: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-24 px-2 py-1 text-xs font-mono-data bg-surface-container border border-outline-variant rounded text-on-surface focus:outline-none"
                />
                <span className="text-[11px] text-on-surface-variant">/mo</span>
              </div>
            </div>
          </div>

          {/* LEVER 4: Marketing & User Acquisition */}
          <div className="space-y-2 p-4 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">campaign</span>
                <span>Marketing & Ads Budget (Δ/mo)</span>
              </label>
              <span className="font-mono-data font-bold text-xs text-on-surface">
                {assumptions.marketingSpendDelta >= 0 ? '+' : ''}
                {formatCurrency(assumptions.marketingSpendDelta, currency)}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Paid growth campaigns, performance marketing, sponsorships, and lead acquisition.
            </p>
            <input
              type="range"
              min={-20000}
              max={50000}
              step={1000}
              value={assumptions.marketingSpendDelta}
              onChange={(e) =>
                setAssumptions((prev: ScenarioAssumptions) => ({ ...prev, marketingSpendDelta: Number(e.target.value) }))
              }
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono-data text-on-surface-variant">
              <span>-$20K/mo</span>
              <span>Baseline ($0)</span>
              <span>+$50K/mo</span>
            </div>
          </div>

          {/* LEVER 5: Cloud & Infrastructure Spend */}
          <div className="space-y-2 p-4 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-secondary">cloud</span>
                <span>Infrastructure & Hosting (Δ/mo)</span>
              </label>
              <span className="font-mono-data font-bold text-xs text-on-surface">
                {assumptions.infrastructureSpendDelta >= 0 ? '+' : ''}
                {formatCurrency(assumptions.infrastructureSpendDelta, currency)}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              GPU servers, database scale-up, vector storage, and high-availability hosting infrastructure.
            </p>
            <input
              type="range"
              min={-10000}
              max={30000}
              step={500}
              value={assumptions.infrastructureSpendDelta}
              onChange={(e) =>
                setAssumptions((prev: ScenarioAssumptions) => ({
                  ...prev,
                  infrastructureSpendDelta: Number(e.target.value),
                }))
              }
              className="w-full accent-secondary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono-data text-on-surface-variant">
              <span>-$10K/mo</span>
              <span>Baseline ($0)</span>
              <span>+$30K/mo</span>
            </div>
          </div>

          {/* LEVER 6: Direct Contract / Incremental Revenue */}
          <div className="space-y-2 p-4 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-secondary">contract</span>
                <span>New Contract / MRR (Δ/mo)</span>
              </label>
              <span className="font-mono-data font-bold text-xs text-secondary">
                {assumptions.additionalMonthlyRevenue >= 0 ? '+' : ''}
                {formatCurrency(assumptions.additionalMonthlyRevenue, currency)}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Direct recurring revenue commitments or expansion of signed enterprise contracts.
            </p>
            <input
              type="range"
              min={-20000}
              max={60000}
              step={1000}
              value={assumptions.additionalMonthlyRevenue}
              onChange={(e) =>
                setAssumptions((prev: ScenarioAssumptions) => ({
                  ...prev,
                  additionalMonthlyRevenue: Number(e.target.value),
                }))
              }
              className="w-full accent-secondary cursor-pointer"
            />

            <div className="flex justify-between text-[10px] font-mono-data text-on-surface-variant">
              <span>-$20K/mo</span>
              <span>Baseline ($0)</span>
              <span>+$60K/mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* 12-Month Projected Trajectory Table */}
      <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-outline-variant/60 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-on-surface font-headline-md">
              12-Month Deterministic Trajectory
            </h2>
            <p className="text-xs text-on-surface-variant">
              Month-by-month cash balances comparing authoritative baseline run-rate against scenario commitments.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-on-surface-variant">
              <span className="w-2.5 h-2.5 rounded-full bg-outline"></span> Baseline
            </span>
            <span className="flex items-center gap-1 text-secondary font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> Scenario
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/60 text-on-surface-variant uppercase tracking-wider font-mono-data text-[10px]">
                <th className="py-2.5 px-3">Horizon</th>
                <th className="py-2.5 px-3">Baseline Cash</th>
                <th className="py-2.5 px-3">Scenario Cash</th>
                <th className="py-2.5 px-3">Variance (Δ)</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 font-mono-data">
              {analysis.trajectory.map((pt: MonthlyTrajectoryPoint) => {
                const isDepleted = pt.scenarioCash <= 0 && !analysis.scenario.isCashFlowPositive;
                return (
                  <tr key={pt.monthIndex} className={isDepleted ? 'bg-error/5' : 'hover:bg-surface-container-low/40'}>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">{pt.monthLabel}</td>
                    <td className="py-2.5 px-3 text-on-surface-variant">
                      {formatCurrency(pt.baselineCash, currency)}
                    </td>
                    <td className={`py-2.5 px-3 font-semibold ${isDepleted ? 'text-error font-bold' : 'text-on-surface'}`}>
                      {formatCurrency(pt.scenarioCash, currency)}
                    </td>
                    <td className={`py-2.5 px-3 font-semibold ${pt.deltaCash >= 0 ? 'text-secondary' : 'text-error'}`}>
                      {pt.deltaCash >= 0 ? '+' : ''}{formatCurrency(pt.deltaCash, currency)}
                    </td>
                    <td className="py-2.5 px-3">
                      {isDepleted ? (
                        <span className="px-2 py-0.5 rounded bg-error/20 text-error text-[10px] font-bold">
                          Cash Depleted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary text-[10px] font-medium">
                          Funded
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saved Scenarios Archive */}
      {savedScenarios.length > 0 && (
        <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-outline-variant/60 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-on-surface font-headline-md">
            Saved What-If Models (Current Session)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {savedScenarios.map((scen) => (
              <div
                key={scen.id}
                className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-on-surface">{scen.name}</span>
                    <span className="text-[10px] font-mono-data text-on-surface-variant">{scen.createdAt}</span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant mt-1">
                    Hires: +{scen.assumptions.hiringCount} | Mktg: {formatCurrency(scen.assumptions.marketingSpendDelta, currency)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => loadSavedScenario(scen)}
                  className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container transition-all cursor-pointer self-start"
                >
                  Load Model
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Scenario Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-on-surface font-headline-md">
                Save Scenario Model
              </h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant">
              Save this planning scenario for your current session. Saved models are kept in-memory and will reset if you reload the page. This will not modify real ledger records.
            </p>

            <form onSubmit={handleSaveScenario} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-on-surface block mb-1">
                  Scenario Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Aggressive Growth Plan"
                  value={scenarioNameInput}
                  onChange={(e) => setScenarioNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 border border-outline-variant text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container shadow-md"
                >
                  Save Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
