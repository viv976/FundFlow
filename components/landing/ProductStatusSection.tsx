'use client';

import React from 'react';

export const ProductStatusSection: React.FC = () => {
  return (
    <section id="product-status" className="py-16 md:py-20 bg-surface-container-low/40 border-t border-outline-variant/40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-3">
          <span className="text-xs font-mono-data font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-md">
            Product Status & Transparency
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
            Engineering Transparency & Sandbox Disclosures
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant font-body-sm leading-relaxed max-w-2xl mx-auto">
            FundFlow is an actively developed early-stage minimum viable product (MVP) built to provide founders with reliable, deterministic financial calculations and grounded intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current Development Stage */}
          <div className="p-5 bg-surface-container-lowest border border-outline-variant/70 rounded-xl space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs">
              <span className="material-symbols-outlined text-sm text-secondary">build</span>
              <span>Actively Developed MVP</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              FundFlow is in active development. All calculations (cash balance, 3-month rolling burn, runway, and headcount scenario impact) are executed via pure TypeScript functions without generative LLM hallucination.
            </p>
          </div>

          {/* Simulated Demo Data */}
          <div className="p-5 bg-surface-container-lowest border border-outline-variant/70 rounded-xl space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs">
              <span className="material-symbols-outlined text-sm text-tertiary">dataset</span>
              <span>Simulated Demonstration Data</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              The public demo workspace represents a synthetic company (<strong className="text-on-surface">Acme Technologies</strong>) and persona (<strong className="text-on-surface">Alex Rivera</strong>). No real customer transactions, identities, or proprietary corporate data are exposed.
            </p>
          </div>
        </div>

        {/* Regulatory & Advisory Disclaimer */}
        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 flex items-start gap-3">
          <span className="material-symbols-outlined text-outline text-[20px] shrink-0 mt-0.5">
            info
          </span>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            <strong className="text-on-surface font-semibold">Important Notice:</strong> FundFlow is financial analysis and decision-support software. It is not a substitute for professional accounting, tax, investment, or legal financial advice. All projections are mathematical models based on historical ledger entries provided by the user.
          </p>
        </div>
      </div>
    </section>
  );
};
