'use client';

import React from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency } from '@/lib/finance/calculator';

export const KPICards: React.FC = () => {
  const { kpis, workspace } = useFinance();

  const formattedCash = formatCurrency(kpis.cashOnHand, workspace.currency);
  const formattedBurn = formatCurrency(kpis.monthlyBurn, workspace.currency);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      {/* KPI 1: Cash on Hand */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 hover:border-outline transition-colors relative overflow-hidden group shadow-sm">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
          <span className="material-symbols-outlined text-5xl text-primary">account_balance</span>
        </div>
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider block mb-2 font-semibold">
          Cash on Hand
        </span>
        <div className="font-display text-display text-on-background mb-4 font-mono-data">
          {formattedCash}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-surface-container-low text-primary text-xs rounded-sm font-label-md flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            +{kpis.cashChangePercent}%
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">vs last month</span>
        </div>
      </div>

      {/* KPI 2: Monthly Burn */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 hover:border-outline transition-colors relative overflow-hidden group shadow-sm">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
          <span className="material-symbols-outlined text-5xl text-error">local_fire_department</span>
        </div>
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider block mb-2 font-semibold">
          Monthly Burn
        </span>
        <div className="font-display text-display text-on-background mb-4 font-mono-data">
          {formattedBurn}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-surface-container-low text-primary text-xs rounded-sm font-label-md flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_down</span>
            {kpis.burnChangePercent}%
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">vs last month</span>
        </div>
      </div>

      {/* KPI 3: Runway */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 hover:border-outline transition-colors relative overflow-hidden group shadow-sm">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
          <span className="material-symbols-outlined text-5xl text-on-tertiary-container">flight_takeoff</span>
        </div>
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider block mb-2 font-semibold">
          Runway
        </span>
        <div className="font-display text-display text-on-background mb-4 font-mono-data">
          {kpis.runwayDisplay}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {kpis.isCashFlowPositive
              ? 'Cash-flow positive / Net profitable'
              : 'Estimated based on avg burn'}
          </span>
        </div>
      </div>

      {/* KPI 4: MoM Growth */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 hover:border-outline transition-colors relative overflow-hidden group shadow-sm">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
          <span className="material-symbols-outlined text-5xl text-secondary">monitoring</span>
        </div>
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider block mb-2 font-semibold">
          MoM Growth
        </span>
        <div className="font-display text-display text-on-background mb-4 font-mono-data">
          {kpis.momGrowthPercent}%
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-surface-container-low text-primary text-xs rounded-sm font-label-md flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            +{kpis.growthTargetPercent}%
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">vs target</span>
        </div>
      </div>
    </div>
  );
};
