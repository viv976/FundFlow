'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useFinance } from '@/lib/store/finance-context';
import { KPICards } from '@/components/dashboard/KPICards';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';
import { AIInsightsFeed } from '@/components/dashboard/AIInsightsFeed';
import { ExpenseBreakdown } from '@/components/dashboard/ExpenseBreakdown';
import { TransactionModal } from '@/components/transactions/TransactionModal';

export default function DashboardPage() {
  const { transactions, addTransaction, exportReportJSON } = useFinance();
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const recentTransactions = transactions.slice(0, 5);

  const handleCopyReport = () => {
    const json = exportReportJSON();
    navigator.clipboard.writeText(json);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12 w-full">
      {/* Page Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono-data uppercase tracking-wider text-secondary-fixed bg-primary px-2.5 py-0.5 rounded font-bold">
              Verified Corporate Ledger
            </span>
            <span className="text-xs text-on-surface-variant font-medium">• Live Synced</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
            Financial Dashboard
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Real-time runway, burn rate, cash flow trajectory, and risk alerts
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={handleCopyReport}
            className="px-3.5 py-2.5 border border-outline-variant rounded-xl bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Copy Executive JSON Snapshot"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isCopied ? 'check' : 'content_copy'}
            </span>
            <span>{isCopied ? 'Report Copied!' : 'Export Summary'}</span>
          </button>

          <Link
            href="/upload"
            className="px-3.5 py-2.5 border border-outline-variant text-on-surface rounded-xl bg-surface-container-lowest text-xs font-semibold hover:bg-surface-container transition-all shadow-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            <span>Import CSV</span>
          </Link>

          <button
            onClick={() => setIsTxModalOpen(true)}
            className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Entry</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <KPICards />

      {/* Primary Analytics Grid: Cash Flow Projections & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CashFlowChart />
        <AIInsightsFeed />
      </div>

      {/* Secondary Row: Expense Breakdown & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Categorized Spend */}
        <ExpenseBreakdown />

        {/* Right 2 Columns: Recent Transactions Ledger */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
                  Recent Ledger Outflows & Inflows
                </h2>
                <p className="text-body-sm text-on-surface-variant font-body-sm text-xs">
                  Latest recorded ledger entries
                </p>
              </div>
              <Link
                href="/transactions"
                className="text-primary font-label-md text-xs hover:underline flex items-center gap-1 font-semibold"
              >
                Full Ledger ({transactions.length})
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-label-md uppercase">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 font-body-sm">
                  {recentTransactions.map((tx) => {
                    const isIncome = tx.transaction_type === 'income';
                    return (
                      <tr key={tx.id} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="py-3 px-3 font-mono-data text-on-surface-variant whitespace-nowrap">
                          {tx.transaction_date}
                        </td>
                        <td className="py-3 px-3 font-medium text-on-surface">
                          {tx.description}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-label-md uppercase font-semibold">
                            {tx.category}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-mono-data font-semibold whitespace-nowrap ${
                            isIncome ? 'text-secondary' : 'text-on-surface'
                          }`}
                        >
                          {isIncome ? '+' : '-'}${Number(tx.amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-outline-variant/40 flex justify-between items-center text-xs text-on-surface-variant">
            <span>Showing top {recentTransactions.length} of {transactions.length} entries</span>
            <Link
              href="/upload"
              className="text-primary hover:underline font-label-md font-semibold"
            >
              Sync more records &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSave={addTransaction}
      />
    </div>
  );
}
