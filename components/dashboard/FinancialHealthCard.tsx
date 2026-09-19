'use client';

import React, { useState } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { HealthCategory } from '@/types/finance';

function getCategoryColor(category: HealthCategory) {
  switch (category) {
    case 'Strong':
      return {
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        ring: '#10b981',
        text: 'text-emerald-400',
        label: 'Strong',
        desc: 'Disciplined capital efficiency, low customer concentration, and safe runway.',
      };
    case 'Moderate':
      return {
        badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        ring: '#3b82f6',
        text: 'text-blue-400',
        label: 'Moderate',
        desc: 'Solid operational baseline with moderate exposure or growth momentum.',
      };
    case 'Watchlist':
      return {
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        ring: '#f59e0b',
        text: 'text-amber-400',
        label: 'Watchlist',
        desc: 'Heightened burn, contracting margins, or high customer concentration.',
      };
    case 'Critical':
      return {
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        ring: '#f43f5e',
        text: 'text-rose-400',
        label: 'Critical',
        desc: 'Immediate cash-flow distress, severe concentration, or urgent burn deficit.',
      };
    case 'Insufficient Data':
    default:
      return {
        badge: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
        ring: '#64748b',
        text: 'text-on-surface-variant',
        label: 'Insufficient Data',
        desc: 'Requires at least 1 completed historical calendar month to calculate composite score.',
      };
  }
}

export function FinancialHealthCard() {
  const { financialHealth, kpis } = useFinance();
  const [showMethodology, setShowMethodology] = useState(false);

  const { score, category, factors } = financialHealth;
  const completedMonthsCount = kpis.completedMonthsCount ?? 0;
  const styling = getCategoryColor(category);

  // SVG Gauge calculations
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? Math.min(100, Math.max(0, score)) : 0;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 shadow-sm relative overflow-hidden">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-outline-variant/40">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-xl">vital_signs</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface tracking-tight">
                Deterministic Financial Health Score
              </h2>
              <span className={`px-2 py-0.5 text-[11px] font-semibold font-mono-data rounded-full border ${styling.badge}`}>
                {styling.label}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Multi-factor mathematical health model across capital, efficiency, concentration, and growth
            </p>
          </div>
        </div>

        {/* View Methodology Toggle */}
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/60 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">info</span>
          <span>{showMethodology ? 'Hide Methodology' : 'View Methodology'}</span>
        </button>
      </div>

      {/* Main Score & Factors Body */}
      {score === null ? (
        <div className="py-8 text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-surface-container-high mx-auto flex items-center justify-center text-on-surface-variant mb-3">
            <span className="material-symbols-outlined text-2xl">hourglass_empty</span>
          </div>
          <h3 className="text-sm font-semibold text-on-surface">Insufficient Historical Data</h3>
          <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
            Composite financial health scoring requires at least 1 completed historical calendar month preceding the reporting anchor. Currently tracking {completedMonthsCount} completed months.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 items-center">
          {/* Circular Score Gauge */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-surface-container/30 border border-outline-variant/30">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-surface-container-high"
                  fill="transparent"
                />
                {/* Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={styling.ring}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold font-mono-data tracking-tight ${styling.text}`}>
                  {score}
                </span>
                <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">
                  / 100 pts
                </span>
              </div>
            </div>

            <div className="text-center mt-3">
              <div className="text-xs font-semibold text-on-surface">{styling.label} Health Status</div>
              <div className="text-[11px] text-on-surface-variant mt-0.5 max-w-[220px]">
                {styling.desc}
              </div>
            </div>
          </div>

          {/* 4 Factor Progress Bars */}
          <div className="lg:col-span-8 space-y-3.5">
            {factors.map((f, idx) => {
              const pct = Math.round((f.score / f.maxScore) * 100);
              return (
                <div key={idx} className="p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant/30">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div>
                      <span className="font-semibold text-on-surface">{f.name}</span>
                      <span className="text-on-surface-variant ml-2 font-mono-data text-[11px]">
                        ({f.description})
                      </span>
                    </div>
                    <div className="font-mono-data font-semibold text-on-surface">
                      <span>{f.score}</span>
                      <span className="text-on-surface-variant text-[11px]"> / {f.maxScore} pts</span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expandable Methodology Drawer */}
      {showMethodology && (
        <div className="mt-5 pt-4 border-t border-outline-variant/40 bg-surface-container/20 -mx-6 -mb-6 p-6 rounded-b-2xl animate-fadeIn">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider font-mono-data mb-2">
            Deterministic Scoring Model Specification
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
            The FundFlow Financial Health Score is 100% deterministic (no black-box AI estimations). It evaluates 4 distinct vectors grounded in trailing verified ledger data:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
              <div className="font-bold text-on-surface mb-1">1. Runway Safety (40 pts)</div>
              <p className="text-[11px] text-on-surface-variant">
                Evaluates months of runway until cash zero. 40 pts for &ge;12 mos or cash-flow positive; linear scaling down to 0 pts at 0 mos.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
              <div className="font-bold text-on-surface mb-1">2. Operating Efficiency (25 pts)</div>
              <p className="text-[11px] text-on-surface-variant">
                Measures net cash margin across trailing completed months: (Inflow - Outflow) / Inflow. Full 25 pts when cash-flow positive.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
              <div className="font-bold text-on-surface mb-1">3. Concentration (20 pts)</div>
              <p className="text-[11px] text-on-surface-variant">
                Evaluates top single revenue source share across completed months. 20 pts if &le;30%, scaled down if &gt;50% concentration.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
              <div className="font-bold text-on-surface mb-1">4. MoM Growth (15 pts)</div>
              <p className="text-[11px] text-on-surface-variant">
                Compares revenue between latest two completed months (M-1 vs M-2). 15 pts for &ge;10% MoM growth; 0 pts if contracting.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-3 italic">
            Note: Composite categories (Strong &ge;80, Good 60-79, Watchlist 40-59, Critical &lt;40) are uncoupled from runway guarantees. A business with 18 months runway but heavy customer concentration or severe contraction will land on the Watchlist.
          </p>
        </div>
      )}
    </div>
  );
}
