'use client';

import React, { useState } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency } from '@/lib/finance/calculator';
import { MetricExplainModal } from './MetricExplainModal';

export const KPICards: React.FC = () => {
  const { kpis, workspace } = useFinance();
  const [explainMetric, setExplainMetric] = useState<'cash' | 'burn' | 'runway' | 'growth' | null>(null);

  const formattedCash = formatCurrency(kpis.cashOnHand, workspace.currency);
  const formattedBurn = formatCurrency(kpis.monthlyBurn, workspace.currency);

  const k = kpis.completedMonthsCount ?? 0;
  const isK0 = k === 0;

  // Format MoM Growth display safely without fake numbers
  let growthDisplay = 'N/A';
  let growthSubtext = 'vs prior month';
  if (kpis.momGrowthStatus === 'active' && kpis.momGrowthPercent !== null) {
    growthDisplay = `${kpis.momGrowthPercent >= 0 ? '+' : ''}${kpis.momGrowthPercent.toFixed(1)}%`;
    growthSubtext = 'M-1 vs M-2 completed months';
  } else if (kpis.momGrowthStatus === 'pre_revenue') {
    growthDisplay = 'Pre-Revenue';
    growthSubtext = 'No completed revenue recorded';
  } else if (kpis.momGrowthStatus === 'first_revenue_period') {
    growthDisplay = 'First Period';
    growthSubtext = 'First recorded revenue month';
  } else {
    growthDisplay = 'Requires 2 Mos';
    growthSubtext = 'Needs 2 completed calendar months';
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* KPI 1: Cash on Hand */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:border-outline transition-all relative overflow-hidden group shadow-sm flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <span className="material-symbols-outlined text-5xl text-primary">account_balance</span>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                Cash on Hand
              </span>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                Verified Ledger
              </span>
            </div>

            <div className="font-display text-3xl text-on-surface mb-2 font-mono-data font-bold">
              {formattedCash}
            </div>

            <div className="text-xs text-on-surface-variant flex items-center gap-1.5 mb-4">
              <span className="material-symbols-outlined text-[14px] text-primary">history</span>
              <span>Cumulative Inception-to-Date</span>
            </div>
          </div>

          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant font-medium">
              Net balance
            </span>
            <button
              onClick={() => setExplainMetric('cash')}
              className="text-[11px] font-semibold text-primary hover:text-primary-container hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Explain this metric</span>
              <span className="material-symbols-outlined text-[13px]">help_outline</span>
            </button>
          </div>
        </div>

        {/* KPI 2: Monthly Net Burn */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:border-outline transition-all relative overflow-hidden group shadow-sm flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <span className="material-symbols-outlined text-5xl text-error">local_fire_department</span>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                Monthly Net Burn
              </span>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                3-Mo Trailing Deficit
              </span>
            </div>

            <div className="font-display text-3xl text-on-surface mb-2 font-mono-data font-bold">
              {isK0 ? (
                <span className="text-xl text-on-surface-variant font-medium">Insufficient Data</span>
              ) : kpis.monthlyBurn === 0 ? (
                <span className="text-xl text-emerald-400 font-medium">No Net Burn</span>
              ) : (
                `${formattedBurn}/mo`
              )}
            </div>

            <div className="text-xs text-on-surface-variant flex items-center gap-1.5 mb-4">
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">calendar_today</span>
              <span>
                {isK0 ? 'Requires completed calendar months' : `${k} completed month${k > 1 ? 's' : ''} avg`}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant font-medium">
              Monthly deficit
            </span>
            <button
              onClick={() => setExplainMetric('burn')}
              className="text-[11px] font-semibold text-primary hover:text-primary-container hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Explain this metric</span>
              <span className="material-symbols-outlined text-[13px]">help_outline</span>
            </button>
          </div>
        </div>

        {/* KPI 3: Runway */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:border-outline transition-all relative overflow-hidden group shadow-sm flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <span className="material-symbols-outlined text-5xl text-on-tertiary-container">flight_takeoff</span>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                Estimated Runway
              </span>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                Linear Depletion
              </span>
            </div>

            <div className="font-display text-3xl text-on-surface mb-2 font-mono-data font-bold">
              {isK0 ? (
                <span className="text-xl text-on-surface-variant font-medium">Insufficient Data</span>
              ) : (
                kpis.runwayDisplay
              )}
            </div>

            <div className="text-xs text-on-surface-variant flex items-center gap-1.5 mb-4">
              <span className="material-symbols-outlined text-[14px] text-primary">schedule</span>
              <span>
                {isK0
                  ? 'Burn baseline unavailable'
                  : kpis.isCashFlowPositive
                  ? 'Cash-Flow Positive / Net Breakeven'
                  : 'Cash ÷ Trailing Net Burn'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant font-medium">
              Until cash depletion
            </span>
            <button
              onClick={() => setExplainMetric('runway')}
              className="text-[11px] font-semibold text-primary hover:text-primary-container hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Explain this metric</span>
              <span className="material-symbols-outlined text-[13px]">help_outline</span>
            </button>
          </div>
        </div>

        {/* KPI 4: MoM Revenue Growth */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:border-outline transition-all relative overflow-hidden group shadow-sm flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <span className="material-symbols-outlined text-5xl text-secondary">monitoring</span>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                MoM Growth
              </span>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                M-1 vs M-2
              </span>
            </div>

            <div className="font-display text-3xl text-on-surface mb-2 font-mono-data font-bold">
              {growthDisplay}
            </div>

            <div className="text-xs text-on-surface-variant flex items-center gap-1.5 mb-4">
              <span className="material-symbols-outlined text-[14px] text-secondary">trending_up</span>
              <span>{growthSubtext}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant font-medium">
              Trailing revenue velocity
            </span>
            <button
              onClick={() => setExplainMetric('growth')}
              className="text-[11px] font-semibold text-primary hover:text-primary-container hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Explain this metric</span>
              <span className="material-symbols-outlined text-[13px]">help_outline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Metric Explanation Modal */}
      {explainMetric && (
        <MetricExplainModal
          isOpen={true}
          onClose={() => setExplainMetric(null)}
          metricKey={explainMetric}
        />
      )}
    </>
  );
};
