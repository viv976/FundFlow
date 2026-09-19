'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency, calculateTotalInflow, calculateTotalOutflow } from '@/lib/finance/calculator';

export const ExpenseRevenueAnalysis: React.FC = () => {
  const { expenseBreakdown, transactions, workspace } = useFinance();
  const [activeTab, setActiveTab] = useState<'expenses' | 'comparison'>('expenses');

  const activeTxs = transactions.filter((t) => t.status !== 'failed');
  const totalInflow = calculateTotalInflow(activeTxs);
  const totalOutflow = calculateTotalOutflow(activeTxs);
  const netOperatingMargin = totalInflow > 0
    ? Math.round(((totalInflow - totalOutflow) / totalInflow) * 1000) / 10
    : null;
  const netCashFlow = totalInflow - totalOutflow;

  const totalExpenseSum = expenseBreakdown.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
      {/* Header & Tab Selector */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface tracking-tight">
                Expense & Revenue Analysis
              </h2>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
                Layer 5
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Operating cost allocation and net margin telemetry
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex p-1 bg-surface-container rounded-xl border border-outline-variant/40 shrink-0">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'expenses'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Categorized Spend
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'comparison'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Revenue vs Expenses
            </button>
          </div>
        </div>

        {/* Tab 1: Categorized Expenses */}
        {activeTab === 'expenses' && (
          <div>
            {expenseBreakdown.length === 0 ? (
              <div className="py-12 text-center bg-surface-container/20 border border-outline-variant/30 rounded-xl my-2">
                <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant mx-auto mb-2">
                  <span className="material-symbols-outlined text-xl">payments</span>
                </div>
                <div className="text-xs font-semibold text-on-surface">No Recorded Expenses</div>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Categorized spend will automatically render once expense transactions are recorded.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 my-2">
                {expenseBreakdown.map((item, idx) => (
                  <div key={idx} className="group">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">{item.category}</span>
                        <span className="text-[10px] font-mono-data text-on-surface-variant">
                          ({item.transactionCount} tx{item.transactionCount > 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-data text-on-surface-variant text-[11px]">
                          {item.percentage}%
                        </span>
                        <span className="font-mono-data font-bold text-on-surface">
                          {formatCurrency(item.amount, workspace.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.colorClass}`}
                        style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Revenue vs Expenses Summary */}
        {activeTab === 'comparison' && (
          <div className="space-y-4 my-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Total Revenue */}
              <div className="p-3.5 rounded-xl bg-secondary/10 border border-secondary/20">
                <div className="flex items-center justify-between text-xs text-secondary-dim font-medium mb-1">
                  <span>Total Inflow (Revenue)</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                </div>
                <div className="text-xl font-bold font-mono-data text-secondary">
                  {formatCurrency(totalInflow, workspace.currency)}
                </div>
              </div>

              {/* Total Expenses */}
              <div className="p-3.5 rounded-xl bg-error/10 border border-error/20">
                <div className="flex items-center justify-between text-xs text-error font-medium mb-1">
                  <span>Total Outflow (Expenses)</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                </div>
                <div className="text-xl font-bold font-mono-data text-error">
                  {formatCurrency(totalOutflow, workspace.currency)}
                </div>
              </div>
            </div>

            {/* Operating Margin Bar */}
            <div className="p-3.5 rounded-xl bg-surface-container-low/60 border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">Operating Cash Margin</span>
                <span className={`font-mono-data font-bold ${netCashFlow >= 0 ? 'text-secondary' : 'text-error'}`}>
                  {netOperatingMargin !== null ? `${netOperatingMargin >= 0 ? '+' : ''}${netOperatingMargin.toFixed(1)}%` : 'N/A (Pre-revenue)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono-data">
                <span>Net Cash Delta:</span>
                <span className={netCashFlow >= 0 ? 'text-secondary font-semibold' : 'text-error font-semibold'}>
                  {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow, workspace.currency)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer link to Ledger */}
      <div className="pt-3 mt-3 border-t border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant">
        <span>
          {activeTab === 'expenses'
            ? `Total volume: ${formatCurrency(totalExpenseSum, workspace.currency)}`
            : `${activeTxs.length} verified ledger transactions`}
        </span>
        <Link
          href="/transactions"
          className="text-primary hover:underline font-semibold flex items-center gap-1"
        >
          <span>Ledger</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
};
