'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useFinance } from '@/lib/store/finance-context';
import { DEMO_WORKSPACE } from '@/lib/store/demo-data';
import { FinancialHealthCard } from '@/components/dashboard/FinancialHealthCard';
import { KPICards } from '@/components/dashboard/KPICards';
import { AttentionSection } from '@/components/dashboard/AttentionSection';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';
import { ExpenseRevenueAnalysis } from '@/components/dashboard/ExpenseRevenueAnalysis';
import { RecentTransactionsTable } from '@/components/dashboard/RecentTransactionsTable';
import { AIInsightsFeed } from '@/components/dashboard/AIInsightsFeed';
import { TransactionModal } from '@/components/transactions/TransactionModal';

export default function DashboardPage() {
  const { workspace, addTransaction, exportReportJSON } = useFinance();
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const isDemo = workspace.id === DEMO_WORKSPACE.id;

  const handleCopyReport = () => {
    const json = exportReportJSON();
    navigator.clipboard.writeText(json);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16 w-full">
      {/* Page Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono-data uppercase tracking-wider text-secondary-fixed bg-primary px-2.5 py-0.5 rounded font-bold">
              {isDemo ? 'Simulated Demonstration Ledger' : 'Verified Corporate Ledger'}
            </span>
            <span className="text-xs text-on-surface-variant font-medium">
              {isDemo ? '• Demo Sandbox' : '• Live Synced'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
            {isDemo ? `${workspace.name} — Financial Intelligence` : 'Financial Intelligence Dashboard'}
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Deterministic runway, multi-factor health, burn velocity, cash trajectory, and risk mitigation
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={handleCopyReport}
            className="px-3.5 py-2 border border-outline-variant rounded-xl bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Copy Executive JSON Snapshot"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isCopied ? 'check' : 'content_copy'}
            </span>
            <span>{isCopied ? 'Report Copied!' : 'Export JSON'}</span>
          </button>

          <Link
            href="/upload"
            className="px-3.5 py-2 border border-outline-variant text-on-surface rounded-xl bg-surface-container-lowest text-xs font-semibold hover:bg-surface-container transition-all shadow-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            <span>Import CSV</span>
          </Link>

          <button
            onClick={() => setIsTxModalOpen(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Entry</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LAYER 1: Financial Health (Deterministic Composite Score)                */}
      {/* ========================================================================= */}
      <section aria-label="Financial Health">
        <FinancialHealthCard />
      </section>

      {/* ========================================================================= */}
      {/* LAYER 2: Critical Metrics (Cash, Net Burn, Runway, MoM Growth)           */}
      {/* ========================================================================= */}
      <section aria-label="Critical Metrics">
        <KPICards />
      </section>

      {/* ========================================================================= */}
      {/* LAYER 3: Things Requiring Attention (Deterministic Risk Alerts)          */}
      {/* ========================================================================= */}
      <section aria-label="Things Requiring Attention">
        <AttentionSection />
      </section>

      {/* ========================================================================= */}
      {/* LAYER 4: Cash-Flow Trajectory (Cumulative Ledger Actuals & Forecast Cone)*/}
      {/* ========================================================================= */}
      <section aria-label="Cash-Flow Trajectory">
        <CashFlowChart />
      </section>

      {/* ========================================================================= */}
      {/* LAYER 5: Expense / Revenue Analysis (Categorized Spend & Net Margins)    */}
      {/* ========================================================================= */}
      <section aria-label="Expense and Revenue Analysis">
        <ExpenseRevenueAnalysis />
      </section>

      {/* ========================================================================= */}
      {/* LAYER 6: Recent Transactions (Reconciled Ledger Table)                   */}
      {/* ========================================================================= */}
      <section aria-label="Recent Transactions">
        <RecentTransactionsTable onNewEntry={() => setIsTxModalOpen(true)} limit={6} />
      </section>

      {/* ========================================================================= */}
      {/* LAYER 7: AI Insights (Grounded Decision Support Telemetry)              */}
      {/* ========================================================================= */}
      <section aria-label="Financial AI Insights">
        <AIInsightsFeed />
      </section>

      {/* Modal for Manual Transaction Entry */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSave={addTransaction}
      />
    </div>
  );
}
