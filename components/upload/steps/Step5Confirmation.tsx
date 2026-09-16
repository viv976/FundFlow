'use client';

import React, { useState } from 'react';
import { ValidationSummary } from '@/lib/finance/data-pipeline/types';

interface Step5ConfirmationProps {
  summary: ValidationSummary;
  workspaceName: string;
  currency: string;
  onConfirm: () => void;
  onBack: () => void;
}

export const Step5Confirmation: React.FC<Step5ConfirmationProps> = ({
  summary,
  workspaceName,
  currency,
  onConfirm,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'VALID' | 'EXCLUDED'>('VALID');

  const validRows = summary.rowResults.filter((r) => r.status === 'valid' && r.candidate);
  const excludedRows = summary.rowResults.filter((r) => r.status !== 'valid');

  const totalInflow = validRows
    .filter((r) => r.candidate?.transaction_type === 'income')
    .reduce((sum, r) => sum + (r.candidate?.amount || 0), 0);

  const totalOutflow = validRows
    .filter((r) => r.candidate?.transaction_type === 'expense')
    .reduce((sum, r) => sum + (r.candidate?.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-mono-data font-bold text-secondary bg-secondary/15 px-2 py-0.5 rounded">
                Final Review
              </span>
              <span className="text-xs text-on-surface-variant font-medium">Target: {workspaceName}</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface font-headline-md">
              Step 5: Confirm Ingestion into Ledger
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Review exactly which transactions will be written to your database ledger.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-outline-variant text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors"
            >
              Back to Preview
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>Confirm & Persist {validRows.length} Transactions</span>
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
            </button>
          </div>
        </div>

        {/* Financial Volume Impact Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-surface-bright rounded-xl border border-outline-variant/60">
            <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Records to Persist</span>
            <span className="text-2xl font-bold text-primary font-mono-data">
              {validRows.length} <span className="text-xs text-on-surface-variant font-normal">of {summary.totalRecords}</span>
            </span>
          </div>

          <div className="p-4 bg-surface-bright rounded-xl border border-secondary/30">
            <span className="text-[10px] font-mono-data uppercase text-secondary block font-semibold">Total Inflow to Add</span>
            <span className="text-2xl font-bold text-secondary font-mono-data">
              +{currency} {totalInflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-4 bg-surface-bright rounded-xl border border-error/30">
            <span className="text-[10px] font-mono-data uppercase text-error block font-semibold">Total Outflow to Add</span>
            <span className="text-2xl font-bold text-error font-mono-data">
              -{currency} {totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('VALID')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'VALID'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span>Ready to Persist</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-data bg-white/20">
              {validRows.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EXCLUDED')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'EXCLUDED'
                ? 'bg-error text-on-error shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span>Excluded / Skipped</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-data bg-white/20">
              {excludedRows.length}
            </span>
          </button>
        </div>

        {/* Table Content */}
        {activeTab === 'VALID' ? (
          <div className="overflow-x-auto border border-outline-variant/60 rounded-xl max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-bright border-b border-outline-variant text-on-surface sticky top-0 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Amount ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40 bg-surface-container-lowest font-mono-data text-[11px]">
                {validRows.map((r, idx) => {
                  const c = r.candidate!;
                  const isIncome = c.transaction_type === 'income';
                  return (
                    <tr key={idx} className="hover:bg-surface-bright/50">
                      <td className="py-2.5 px-3 text-on-surface-variant whitespace-nowrap">{c.transaction_date}</td>
                      <td className="py-2.5 px-3 font-sans text-xs text-on-surface font-medium max-w-[240px] truncate">
                        {c.description}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface text-[10px] font-semibold uppercase">
                          {c.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            isIncome
                              ? 'bg-secondary/15 text-secondary'
                              : 'bg-error-container/60 text-error'
                          }`}
                        >
                          {c.transaction_type}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                          isIncome ? 'text-secondary' : 'text-on-surface'
                        }`}
                      >
                        {isIncome ? '+' : '-'}${c.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto border border-outline-variant/60 rounded-xl max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-bright border-b border-outline-variant text-on-surface sticky top-0 font-semibold">
                <tr>
                  <th className="py-2.5 px-3 w-16 text-center">Row</th>
                  <th className="py-2.5 px-3 w-28">Status</th>
                  <th className="py-2.5 px-3">Exclusion Reasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40 bg-surface-container-lowest font-mono-data text-[11px]">
                {excludedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-on-surface-variant font-sans text-xs">
                      Zero records excluded. Entire dataset is clean.
                    </td>
                  </tr>
                ) : (
                  excludedRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-surface-bright/50">
                      <td className="py-2.5 px-3 text-center text-outline">#{r.rowNumber}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'duplicate'
                              ? 'bg-surface-container text-outline'
                              : 'bg-error-container text-error'
                          }`}
                        >
                          {r.status === 'duplicate' ? 'Duplicate' : 'Invalid'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-on-surface-variant font-sans text-xs space-y-0.5">
                        {r.issues.map((i, iIdx) => (
                          <div key={iIdx}>• {i.message}</div>
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
