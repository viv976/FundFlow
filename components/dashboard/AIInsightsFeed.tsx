'use client';

import React from 'react';
import Link from 'next/link';
import { useFinance } from '@/lib/store/finance-context';

export const AIInsightsFeed: React.FC = () => {
  const { kpis, expenseBreakdown } = useFinance();

  const topCategory = expenseBreakdown[0]?.category || 'Payroll';
  const topPercent = expenseBreakdown[0]?.percentage || 65;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col h-[400px] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">smart_toy</span>
          <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
            AI Insights
          </h2>
        </div>
        <Link
          href="/ask-ai"
          className="font-label-md text-xs text-primary hover:underline flex items-center gap-1"
        >
          Ask Co-Pilot
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      {/* Feed Scroll */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 chat-scroll">
        {/* Insight 1: Revenue Anomaly */}
        <div className="p-4 bg-surface-container-low border-l-2 border-primary rounded-r-sm transition-all hover:bg-surface-container">
          <h3 className="font-label-md text-label-md text-on-surface mb-1 flex items-center gap-1.5 font-semibold">
            <span className="material-symbols-outlined text-[16px] text-primary">trending_up</span>
            Revenue Anomaly
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Subscription revenue grew +{kpis.momGrowthPercent}% this cycle, outpacing baseline customer cohort forecasts.
          </p>
        </div>

        {/* Insight 2: Burn Rate Alert */}
        <div className="p-4 bg-error-container/30 border-l-2 border-error rounded-r-sm transition-all hover:bg-error-container/40">
          <h3 className="font-label-md text-label-md text-on-surface mb-1 flex items-center gap-1.5 font-semibold">
            <span className="material-symbols-outlined text-[16px] text-error">warning</span>
            Burn Rate Alert
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {topCategory} accounts for {topPercent}% of monthly outflow. Consider reviewing variable contractor allocations.
          </p>
        </div>

        {/* Insight 3: Optimization */}
        <div className="p-4 bg-surface-container-low border-l-2 border-secondary-fixed-dim rounded-r-sm transition-all hover:bg-surface-container">
          <h3 className="font-label-md text-label-md text-on-surface mb-1 flex items-center gap-1.5 font-semibold">
            <span className="material-symbols-outlined text-[16px] text-secondary">lightbulb</span>
            Optimization
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Consolidating cloud services and unassigned software seats could save approximately $1,200/mo.
          </p>
        </div>
      </div>
    </div>
  );
};
