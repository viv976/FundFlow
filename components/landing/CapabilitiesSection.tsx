'use client';

import React from 'react';

interface Capability {
  id: string;
  title: string;
  badge: string;
  icon: string;
  iconColor: string;
  description: string;
  features: string[];
}

const CAPABILITIES: Capability[] = [
  {
    id: 'financial-intelligence',
    title: 'Financial Intelligence',
    badge: 'Deterministic Ledger Math',
    icon: 'account_balance',
    iconColor: 'text-primary',
    description:
      'Eliminate spreadsheet formula errors. Real-time cash on hand, net burn rate, categorized spend allocations, and month-over-month trajectory calculated with pure mathematical precision.',
    features: [
      'Cash balance reconciled against verified inflows and outflows',
      'Categorized operational spend breakdown across engineering, marketing, and payroll',
      'Month-over-month revenue and burn trajectory analytics',
    ],
  },
  {
    id: 'runway-forecasting',
    title: 'Runway & Cash Forecasting',
    badge: 'Rolling Trajectory & Scenarios',
    icon: 'flight_takeoff',
    iconColor: 'text-tertiary-fixed-dim',
    description:
      'Know precisely how many months of operating capital remain. Model future runway impact with deterministic what-if scenario simulations before committing capital.',
    features: [
      'Rolling 3-month average burn calculations with infinite/positive handling',
      'Deterministic headcount hiring impact simulator',
      'Forward cash horizon projections mapped across future operating quarters',
    ],
  },
  {
    id: 'ai-copilot',
    title: 'AI Co-Pilot',
    badge: 'Grounded Financial Retrieval',
    icon: 'smart_toy',
    iconColor: 'text-secondary',
    description:
      'Conversational intelligence grounded in your verified transactions and uploaded corporate documents. Ask questions about burn, spend trends, or runway and receive structured answers with citations.',
    features: [
      'Strictly grounded in verified ledger data and uploaded document chunks',
      'Direct transaction and document citations attached to every answer',
      'Domain-specific intent routing separating spend, scenario, and knowledge queries',
    ],
  },
  {
    id: 'risk-detection',
    title: 'Risk Detection',
    badge: 'Rule-Based Guardrails',
    icon: 'warning',
    iconColor: 'text-error',
    description:
      'Automated rule-based monitoring that surfaces operational risks before they threaten solvency. Configure customizable runway floors, expense spike triggers, and large transaction thresholds.',
    features: [
      'Automated runway alerts when projected cash drops below safety thresholds',
      'Category-level expense spike detection compared against historical baselines',
      'Severity triage across critical, warning, and informational operational events',
    ],
  },
];

export const CapabilitiesSection: React.FC = () => {
  return (
    <section id="capabilities" className="py-16 md:py-24 bg-surface border-t border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-12 md:mb-16">
          <span className="text-xs font-mono-data font-bold uppercase tracking-wider text-secondary bg-secondary-container/30 px-3 py-1 rounded-md">
            Product Capabilities
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-on-surface tracking-tight font-headline-lg">
            Complete financial visibility designed for early-stage teams
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant font-body-md leading-relaxed">
            Every capability is built directly on deterministic TypeScript calculations and grounded document retrieval — no fabricated figures or speculative advice.
          </p>
        </div>

        {/* Capabilities 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.id}
              className="p-6 sm:p-8 bg-surface-container-lowest border border-outline-variant/70 rounded-2xl shadow-sm hover:border-outline-variant hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-low border border-outline-variant/40 flex items-center justify-center shadow-xs">
                    <span className={`material-symbols-outlined text-2xl ${cap.iconColor}`}>
                      {cap.icon}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-data font-semibold text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-md">
                    {cap.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-on-surface mb-2 font-headline-md">
                    {cap.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-outline-variant/40 space-y-2">
                {cap.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-on-surface">
                    <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">
                      check_circle
                    </span>
                    <span className="leading-snug">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
