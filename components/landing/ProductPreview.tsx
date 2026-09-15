'use client';

import React from 'react';
import Link from 'next/link';

export const ProductPreview: React.FC = () => {
  return (
    <section id="product-preview" className="py-16 md:py-24 bg-surface border-t border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-10 md:mb-14">
          <span className="text-xs font-mono-data font-bold uppercase tracking-wider text-primary bg-primary-fixed px-3 py-1 rounded-md">
            Interactive Product Preview
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-on-surface tracking-tight font-headline-lg">
            Experience the FundFlow executive interface
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant font-body-md leading-relaxed">
            A live preview of the actual application interface, rendered with the standard simulated demonstration dataset.
          </p>
        </div>

        {/* Application Window Container */}
        <div className="max-w-5xl mx-auto rounded-2xl border border-outline-variant/80 bg-surface-container-lowest shadow-xl overflow-hidden">
          {/* Mock Browser Title Bar */}
          <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-3 h-3 rounded-full bg-error/70 inline-block" />
              <span className="w-3 h-3 rounded-full bg-tertiary-fixed-dim inline-block" />
              <span className="w-3 h-3 rounded-full bg-secondary-fixed inline-block" />
            </div>

            <div className="flex-1 max-w-md mx-auto hidden sm:flex items-center justify-center gap-2 px-3 py-1 bg-surface-container-lowest rounded-lg border border-outline-variant/50 text-[11px] font-mono-data text-on-surface-variant truncate">
              <span className="material-symbols-outlined text-[14px] text-secondary">lock</span>
              <span className="truncate">app.fundflow.local/dashboard</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-secondary-fixed/20 text-secondary font-bold uppercase">
                DEMO
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/demo"
                className="px-2.5 py-1 rounded-md bg-primary text-on-primary text-[11px] font-semibold hover:bg-primary-container transition-colors flex items-center gap-1"
              >
                <span>Launch Interactive Demo</span>
                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
              </Link>
            </div>
          </div>

          {/* Simulated Workspace Header Banner */}
          <div className="bg-primary/5 px-4 sm:px-6 py-2 border-b border-outline-variant/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-primary text-secondary-fixed text-[9px] font-mono-data font-bold uppercase">
                PREVIEW
              </span>
              <span className="text-on-surface-variant text-[11px]">
                Active Entity: <strong className="text-on-surface">Acme Technologies</strong> (Simulated Sandbox Data)
              </span>
            </div>
            <span className="hidden md:inline-block text-[11px] font-mono-data text-outline">
              Base Currency: USD ($)
            </span>
          </div>

          {/* Embedded UI Preview Content */}
          <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-surface/50">
            {/* KPI Cards Preview Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Cash on Hand */}
              <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-4 shadow-2xs">
                <span className="text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider block mb-1 font-semibold">
                  Cash on Hand
                </span>
                <div className="text-2xl font-bold text-on-surface font-mono-data mb-2">
                  $1,155,005.00
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-primary">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  <span className="font-semibold">+5.2%</span>
                  <span className="text-on-surface-variant font-normal">vs last month</span>
                </div>
              </div>

              {/* Monthly Burn */}
              <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-4 shadow-2xs">
                <span className="text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider block mb-1 font-semibold">
                  Monthly Burn
                </span>
                <div className="text-2xl font-bold text-on-surface font-mono-data mb-2">
                  $85,000.00
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-primary">
                  <span className="material-symbols-outlined text-[14px]">trending_down</span>
                  <span className="font-semibold">-2.1%</span>
                  <span className="text-on-surface-variant font-normal">vs last month</span>
                </div>
              </div>

              {/* Runway */}
              <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-4 shadow-2xs">
                <span className="text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider block mb-1 font-semibold">
                  Runway
                </span>
                <div className="text-2xl font-bold text-on-surface font-mono-data mb-2">
                  13.6 Mos
                </div>
                <div className="text-[11px] text-on-surface-variant">
                  Estimated on 3-mo rolling avg
                </div>
              </div>

              {/* MoM Growth */}
              <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-4 shadow-2xs">
                <span className="text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider block mb-1 font-semibold">
                  MoM Growth
                </span>
                <div className="text-2xl font-bold text-on-surface font-mono-data mb-2">
                  12.4%
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-primary">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  <span className="font-semibold">+15.0%</span>
                  <span className="text-on-surface-variant font-normal">vs target</span>
                </div>
              </div>
            </div>

            {/* Split Analytics & Attention Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cash Flow Trajectory Chart Preview */}
              <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-on-surface font-headline-md">
                      Cash Flow & Forward Horizon
                    </h3>
                    <p className="text-[11px] text-on-surface-variant">
                      Historical actuals and 3-month forecast projection
                    </p>
                  </div>
                  <span className="text-[10px] font-mono-data text-secondary uppercase tracking-wider bg-secondary/10 px-2 py-0.5 rounded font-bold">
                    Forward Runway
                  </span>
                </div>

                {/* SVG Mini Chart */}
                <div className="h-44 w-full relative">
                  <svg className="w-full h-full" viewBox="0 0 500 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="previewGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#002546" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#002546" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 20 50 Q 120 70 200 90 T 350 110 L 480 135 L 480 160 L 20 160 Z"
                      fill="url(#previewGradient)"
                    />
                    <path
                      d="M 20 50 Q 120 70 200 90 T 350 110"
                      fill="none"
                      stroke="#002546"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M 350 110 L 480 135"
                      fill="none"
                      stroke="#002546"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    {/* Points */}
                    <circle cx="20" cy="50" r="3.5" fill="#002546" />
                    <circle cx="200" cy="90" r="3.5" fill="#002546" />
                    <circle cx="350" cy="110" r="4.5" fill="#006c49" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="480" cy="135" r="3.5" fill="#002546" />
                  </svg>
                  <div className="flex justify-between text-[10px] font-mono-data text-outline pt-1">
                    <span>Aug 2023 ($1.39M)</span>
                    <span>Current ($1.15M)</span>
                    <span>Q1 Forecast ($980k)</span>
                  </div>
                </div>

                {/* Active Risk Guardrail Card */}
                <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/60 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">
                    warning
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-on-surface block">
                      Active Guardrail: Unusual Expense Spike Detected
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Marketing category spending is 45% higher than 30-day moving average.
                    </span>
                  </div>
                </div>
              </div>

              {/* Categorized Spend & Recent Activity Preview */}
              <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-on-surface font-headline-md mb-1">
                    Recent Ledger Activity
                  </h3>
                  <p className="text-[11px] text-on-surface-variant mb-3">
                    Sample transaction stream
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50">
                      <div>
                        <span className="font-semibold text-on-surface block">Stripe Payout</span>
                        <span className="text-[10px] font-mono-data text-outline">2023-10-22 • Revenue</span>
                      </div>
                      <span className="font-mono-data font-bold text-secondary">+$8,450.00</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50">
                      <div>
                        <span className="font-semibold text-on-surface block">Gusto Payroll</span>
                        <span className="text-[10px] font-mono-data text-outline">2023-10-21 • Payroll</span>
                      </div>
                      <span className="font-mono-data font-bold text-on-surface">-$27,500.00</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/50">
                      <div>
                        <span className="font-semibold text-on-surface block">AWS Cloud Services</span>
                        <span className="text-[10px] font-mono-data text-outline">2023-10-24 • Hosting</span>
                      </div>
                      <span className="font-mono-data font-bold text-on-surface">-$1,245.00</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-outline-variant/40 text-center">
                  <Link
                    href="/demo"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>Test Full Dashboard with 18 Transactions &rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
