'use client';

import React from 'react';
import Link from 'next/link';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency } from '@/lib/finance/calculator';

export const AIInsightsFeed: React.FC = () => {
  const { kpis, expenseBreakdown, workspace } = useFinance();
  const currency = workspace?.currency || 'USD';

  const topCategory = expenseBreakdown[0];
  const k = kpis.completedMonthsCount ?? 0;
  const isK0 = k === 0;

  // Generate grounded dynamic insights based strictly on verified ledger state
  const insights: Array<{
    title: string;
    description: string;
    icon: string;
    badge: string;
    borderClass: string;
    iconClass: string;
  }> = [];

  if (isK0) {
    insights.push({
      title: 'Awaiting Completed Month Baseline',
      description:
        'Ledger intelligence requires at least 1 completed historical calendar month to detect anomalies, analyze burn velocity, and optimize operating cash flow.',
      icon: 'schedule',
      badge: 'Data Prerequisite',
      borderClass: 'border-l-primary',
      iconClass: 'text-primary',
    });
  } else {
    // 1. Runway & Health insight
    if (kpis.isCashFlowPositive) {
      insights.push({
        title: 'Operating Profitability Observed',
        description: `Verified trailing cash inflows meet or exceed operating expenses across the trailing ${k}-month completed window. Runway is sustainable indefinitely at current operations.`,
        icon: 'verified',
        badge: 'Capital Safety',
        borderClass: 'border-l-secondary',
        iconClass: 'text-secondary',
      });
    } else if (kpis.runwayMonths < 6) {
      insights.push({
        title: 'Compressed Runway Horizon',
        description: `Current capital reserve provides ${kpis.runwayDisplay} at a net burn of ${formatCurrency(kpis.monthlyBurn, currency)}/mo. Prioritize discretionary expenditure controls or fundraising planning.`,
        icon: 'warning',
        badge: 'Runway Priority',
        borderClass: 'border-l-error',
        iconClass: 'text-error',
      });
    } else {
      insights.push({
        title: 'Adequate Liquidity Buffer',
        description: `Runway stands at ${kpis.runwayDisplay}, providing capital runway past the standard 6-month operational horizon under steady-state expenditure.`,
        icon: 'check_circle',
        badge: 'Runway Nominal',
        borderClass: 'border-l-secondary',
        iconClass: 'text-secondary',
      });
    }

    // 2. Spend Allocation Insight
    if (topCategory) {
      insights.push({
        title: `Primary Spend: ${topCategory.category}`,
        description: `${topCategory.category} represents ${topCategory.percentage}% of all recorded operating expenses (${formatCurrency(topCategory.amount, currency)} across ${topCategory.transactionCount} entries).`,
        icon: 'pie_chart',
        badge: 'Allocation',
        borderClass: 'border-l-primary',
        iconClass: 'text-primary',
      });
    }

    // 3. Growth Momentum Insight
    if (kpis.momGrowthStatus === 'active' && kpis.momGrowthPercent !== null) {
      if (kpis.momGrowthPercent >= 0) {
        insights.push({
          title: 'Positive Revenue Velocity',
          description: `Trailing revenue expanded by +${kpis.momGrowthPercent.toFixed(1)}% between prior completed months, supporting overall financial health momentum.`,
          icon: 'trending_up',
          badge: 'Momentum',
          borderClass: 'border-l-secondary',
          iconClass: 'text-secondary',
        });
      } else {
        insights.push({
          title: 'Revenue Contraction Observed',
          description: `Revenue decreased by ${kpis.momGrowthPercent.toFixed(1)}% in the latest completed cycle. Monitor customer churn and recurring subscription collections.`,
          icon: 'trending_down',
          badge: 'Revenue Velocity',
          borderClass: 'border-l-amber-400',
          iconClass: 'text-amber-400',
        });
      }
    } else if (kpis.momGrowthStatus === 'pre_revenue') {
      insights.push({
        title: 'Pre-Revenue Capital Focus',
        description: 'No recurring revenue streams logged in the completed horizon. Capital preservation and net burn monitoring remain paramount.',
        icon: 'lightbulb',
        badge: 'Operating Stage',
        borderClass: 'border-l-primary',
        iconClass: 'text-primary',
      });
    }
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 flex flex-col justify-between shadow-sm min-h-[420px]">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-lg">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-on-surface tracking-tight">
                  Financial AI Insights
                </h2>
                <span className="text-[10px] font-mono-data px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
                  Layer 7
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Synthesized decision-support telemetry
              </p>
            </div>
          </div>
          <Link
            href="/ask-ai"
            className="text-primary font-label-md text-xs hover:underline flex items-center gap-1 font-semibold"
          >
            <span>Co-Pilot</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        {/* Dynamic Grounded Insights Feed */}
        <div className="space-y-3 my-2">
          {insights.map((item, idx) => (
            <div
              key={idx}
              className={`p-3.5 bg-surface-container-low/60 border-l-4 ${item.borderClass} rounded-r-xl border-y border-r border-outline-variant/30 hover:bg-surface-container transition-all`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className={`material-symbols-outlined text-[15px] ${item.iconClass}`}>
                    {item.icon}
                  </span>
                  <span>{item.title}</span>
                </span>
                <span className="text-[10px] font-mono-data text-on-surface-variant px-1.5 py-0.5 rounded bg-surface-container-high font-medium">
                  {item.badge}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed pl-5">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer link to AI Co-Pilot */}
      <div className="pt-3 mt-3 border-t border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant">
        <span>Grounded in verified ledger metrics</span>
        <Link
          href="/ask-ai"
          className="text-primary hover:underline font-semibold flex items-center gap-1"
        >
          <span>Ask deep question</span>
          <span className="material-symbols-outlined text-sm">chat</span>
        </Link>
      </div>
    </div>
  );
};
