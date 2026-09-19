'use client';

import React from 'react';
import Link from 'next/link';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency } from '@/lib/finance/calculator';
import { Transaction } from '@/types/finance';

interface RecentTransactionsTableProps {
  onNewEntry?: () => void;
  limit?: number;
}

function getStatusBadge(status?: Transaction['status']) {
  switch (status) {
    case 'reconciled':
      return 'bg-secondary/10 text-secondary border-secondary/30';
    case 'pending':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'failed':
      return 'bg-error/10 text-error border-error/30';
    case 'completed':
    default:
      return 'bg-surface-container-high text-on-surface-variant border-outline-variant/50';
  }
}

export function RecentTransactionsTable({
  onNewEntry,
  limit = 6,
}: RecentTransactionsTableProps) {
  const { transactions, workspace } = useFinance();
  const recentTransactions = transactions.slice(0, limit);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface tracking-tight">
                Recent Ledger Activity
              </h2>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
                Layer 6
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Verified multi-currency ledger entries with reconciliation state
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNewEntry && (
              <button
                onClick={onNewEntry}
                className="px-3 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>Add Record</span>
              </button>
            )}
            <Link
              href="/transactions"
              className="text-primary font-label-md text-xs hover:underline flex items-center gap-1 font-semibold px-2 py-1.5"
            >
              <span>Full Ledger</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Transactions Table or Empty State */}
        {recentTransactions.length === 0 ? (
          <div className="py-12 text-center bg-surface-container/20 border border-outline-variant/30 rounded-xl my-2">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant mx-auto mb-2">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <div className="text-xs font-semibold text-on-surface">No Ledger Entries Found</div>
            <p className="text-[11px] text-on-surface-variant mt-1 max-w-sm mx-auto">
              No transactions recorded yet in this workspace. Import a CSV bank export or manually log an entry to generate real-time metrics.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/upload"
                className="px-3 py-1.5 bg-surface-container-high text-on-surface hover:bg-surface-container-highest rounded-lg text-xs font-semibold transition-colors"
              >
                Upload CSV
              </Link>
              {onNewEntry && (
                <button
                  onClick={onNewEntry}
                  className="px-3 py-1.5 bg-primary text-on-primary hover:bg-primary-container rounded-lg text-xs font-semibold transition-colors"
                >
                  Log First Entry
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/50 text-on-surface-variant font-label-md uppercase text-[11px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 font-body-sm">
                {recentTransactions.map((tx) => {
                  const isIncome = tx.transaction_type === 'income';
                  const statusBadgeClass = getStatusBadge(tx.status);
                  const isFailed = tx.status === 'failed';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-surface-container-low/40 transition-colors ${
                        isFailed ? 'opacity-50 line-through' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono-data text-on-surface-variant whitespace-nowrap">
                        {tx.transaction_date}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-on-surface max-w-[200px] truncate">
                        {tx.description}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-label-md uppercase font-semibold">
                          {tx.category || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono-data uppercase font-semibold border ${statusBadgeClass}`}
                        >
                          {tx.status || 'completed'}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono-data font-semibold whitespace-nowrap ${
                          isFailed
                            ? 'text-on-surface-variant'
                            : isIncome
                            ? 'text-secondary'
                            : 'text-on-surface'
                        }`}
                      >
                        {isIncome ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)), workspace?.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      {recentTransactions.length > 0 && (
        <div className="pt-3 mt-2 border-t border-outline-variant/40 flex justify-between items-center text-xs text-on-surface-variant">
          <span>Showing latest {recentTransactions.length} of {transactions.length} entries</span>
          <Link
            href="/upload"
            className="text-primary hover:underline font-semibold"
          >
            Import CSV batch &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
