'use client';

import React from 'react';

interface PipelineStep {
  step: string;
  name: string;
  badge: string;
  icon: string;
  description: string;
  implementation: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    step: '01',
    name: 'Transactions',
    badge: 'CSV Ingestion & Mapping',
    icon: 'cloud_upload',
    description:
      'Ingest transaction statements with automated column mapping, debit/credit normalization, and rule-based keyword categorization.',
    implementation: 'PapaParse client parser, multi-format date normalization, and deduplication engine.',
  },
  {
    step: '02',
    name: 'Financial Engine',
    badge: 'Deterministic Math',
    icon: 'calculate',
    description:
      'Compute foundational financial metrics: starting balance reconciliation, rolling multi-month burn rate, and runway horizon.',
    implementation: 'Centralized TypeScript calculation functions with zero external runtime math dependencies.',
  },
  {
    step: '03',
    name: 'Context Retrieval',
    badge: 'Ledger & Document RAG',
    icon: 'manage_search',
    description:
      'Extract relevant transaction records, monthly ledger aggregates, and corporate knowledge base documents for contextual grounding.',
    implementation: 'Multi-tenant workspace document and chunk retrieval combined with ledger snapshot queries.',
  },
  {
    step: '04',
    name: 'AI Analysis',
    badge: 'Intent Classification',
    icon: 'psychology',
    description:
      'Classify founder queries into specialized intents: spend analysis, what-if headcount modeling, or accounting explanations.',
    implementation: 'Regex and pattern-matched domain routing separating queries with strict out-of-domain refusal.',
  },
  {
    step: '05',
    name: 'Actionable Insights',
    badge: 'Grounded Output & Alerts',
    icon: 'insights',
    description:
      'Deliver clear answers with verified transaction citations, forward scenario projections, and automated risk alert evaluations.',
    implementation: 'Audited responses linking to actual ledger entries alongside automated runway and burn alerts.',
  },
];

export const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-surface-container-low/50 border-t border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-12 md:mb-16">
          <span className="text-xs font-mono-data font-bold uppercase tracking-wider text-primary bg-primary-fixed px-3 py-1 rounded-md">
            Operational Architecture
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-on-surface tracking-tight font-headline-lg">
            How FundFlow turns raw ledger data into actionable intelligence
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant font-body-md leading-relaxed">
            A transparent five-stage pipeline where every calculation is mathematically verified before being surfaced to your team.
          </p>
        </div>

        {/* Pipeline Steps (Horizontal on large screens, vertical on mobile/tablet) */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-3">
          {PIPELINE_STEPS.map((step, idx) => (
            <div
              key={step.step}
              className="relative bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                {/* Step Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl font-mono-data font-bold text-primary">
                    {step.step}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">
                      {step.icon}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-on-surface mb-1 font-headline-md">
                  {step.name}
                </h3>
                <span className="text-[10px] font-mono-data font-semibold text-secondary uppercase tracking-wider block mb-2">
                  {step.badge}
                </span>

                <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                  {step.description}
                </p>
              </div>

              <div className="pt-3 border-t border-outline-variant/30">
                <span className="text-[10px] font-mono-data text-outline block leading-tight">
                  <strong className="text-on-surface-variant font-semibold">Engine:</strong> {step.implementation}
                </span>
              </div>

              {/* Arrow connector for desktop */}
              {idx < PIPELINE_STEPS.length - 1 && (
                <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
                  <span className="material-symbols-outlined text-outline-variant text-[18px]">
                    arrow_forward
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
