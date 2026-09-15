'use client';

import React from 'react';
import Link from 'next/link';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 bg-gradient-to-b from-surface via-surface-container-lowest to-surface">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 pointer-events-none overflow-hidden opacity-35">
        <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-secondary-fixed/40 blur-3xl" />
        <div className="absolute -top-12 right-1/4 w-80 h-80 rounded-full bg-primary-fixed/50 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        {/* Positioning Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/15 text-primary text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span>Financial intelligence for early-stage teams.</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-on-surface tracking-tight font-headline-lg max-w-4xl mx-auto leading-[1.15]">
          Know your true runway, burn, and cash flow without spreadsheet drift.
        </h1>

        {/* Value Proposition Description */}
        <p className="text-sm sm:text-base lg:text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed font-body-lg">
          FundFlow connects your transaction records to a deterministic calculation engine, automated risk guardrails, and grounded contextual analysis. Gain CFO-level operational visibility without guesswork.
        </p>

        {/* Action CTAs */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            href="/demo"
            className="w-full sm:w-auto px-6 py-3.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 group"
          >
            <span>Explore Demo</span>
            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </Link>

          <a
            href="https://github.com/viv976/FundFlow"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3.5 border border-outline-variant bg-surface-container-lowest text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">code</span>
            <span>View GitHub</span>
          </a>
        </div>

        {/* Architectural Pillars / Trust Badges */}
        <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
          <div className="p-3 bg-surface-container-lowest/80 border border-outline-variant/60 rounded-xl shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-0.5">
              <span className="material-symbols-outlined text-sm text-secondary">calculate</span>
              <span>Deterministic Math</span>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-snug">
              Exact calculations for cash, burn, and runway derived directly from ledger rows.
            </p>
          </div>

          <div className="p-3 bg-surface-container-lowest/80 border border-outline-variant/60 rounded-xl shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-0.5">
              <span className="material-symbols-outlined text-sm text-primary">link</span>
              <span>Grounded Context</span>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-snug">
              Conversational Q&A grounded strictly in verified ledger data and policy documents.
            </p>
          </div>

          <div className="p-3 bg-surface-container-lowest/80 border border-outline-variant/60 rounded-xl shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-0.5">
              <span className="material-symbols-outlined text-sm text-tertiary">shield</span>
              <span>Isolated Workspaces</span>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-snug">
              Strict multi-tenant boundaries separating corporate entities and financial ledgers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
