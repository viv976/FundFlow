'use client';

import React from 'react';
import Link from 'next/link';

interface Step7CompletionProps {
  importedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  rejectedReasons: { row: number; reason: string }[];
  duplicates: { row: number; description: string; amount: number; fingerprint: string }[];
  onReset: () => void;
  workspaceName: string;
}

export const Step7Completion: React.FC<Step7CompletionProps> = ({
  importedCount,
  rejectedCount,
  duplicateCount,
  rejectedReasons,
  duplicates,
  onReset,
  workspaceName,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 shadow-sm space-y-6">
        {/* Success Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface font-headline-md">
                Ingestion Complete
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Financial records have been validated and reconciled in <strong>{workspaceName}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onReset}
              className="px-4 py-2 border border-outline-variant text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors cursor-pointer"
            >
              Upload Another CSV
            </button>
            <Link
              href="/transactions"
              className="px-6 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>View Transaction Ledger</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Ingestion KPI Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-secondary-container/20 border border-secondary/30 rounded-xl">
            <div className="flex items-center gap-2 mb-1 text-secondary font-bold text-xs uppercase font-label-md">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Records Imported</span>
            </div>
            <span className="text-3xl font-bold text-secondary font-mono-data">
              +{importedCount}
            </span>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Normalized and persisted with stable identifiers.
            </p>
          </div>

          <div className="p-5 bg-surface-bright border border-outline-variant/60 rounded-xl">
            <div className="flex items-center gap-2 mb-1 text-outline font-bold text-xs uppercase font-label-md">
              <span className="material-symbols-outlined text-sm">content_copy</span>
              <span>Duplicates Skipped</span>
            </div>
            <span className="text-3xl font-bold text-on-surface font-mono-data">
              {duplicateCount}
            </span>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Prevented re-import via deterministic fingerprinting.
            </p>
          </div>

          <div className="p-5 bg-surface-bright border border-outline-variant/60 rounded-xl">
            <div className="flex items-center gap-2 mb-1 text-error font-bold text-xs uppercase font-label-md">
              <span className="material-symbols-outlined text-sm">block</span>
              <span>Records Rejected</span>
            </div>
            <span className={`text-3xl font-bold font-mono-data ${rejectedCount > 0 ? 'text-error' : 'text-on-surface'}`}>
              {rejectedCount}
            </span>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Failed strict validation (never imported silently).
            </p>
          </div>
        </div>

        {/* Detailed Rejection Reasons Section */}
        {rejectedReasons.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-error uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">error</span>
              <span>Rejected Record Details ({rejectedReasons.length})</span>
            </h3>
            <div className="border border-error/30 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-error-container/20 text-error font-semibold border-b border-error/20">
                  <tr>
                    <th className="py-2 px-3 w-16 text-center">Row</th>
                    <th className="py-2 px-3">Rejection Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-error/10 bg-surface-container-lowest font-mono-data text-[11px]">
                  {rejectedReasons.map((rej, idx) => (
                    <tr key={idx} className="hover:bg-error-container/10">
                      <td className="py-2 px-3 text-center text-outline">#{rej.row}</td>
                      <td className="py-2 px-3 text-on-surface font-sans">{rej.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Duplicates Section */}
        {duplicates.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-outline">copy_all</span>
              <span>Skipped Duplicate Candidates ({duplicates.length})</span>
            </h3>
            <div className="border border-outline-variant/60 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-bright text-on-surface font-semibold border-b border-outline-variant">
                  <tr>
                    <th className="py-2 px-3 w-16 text-center">Row</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Fingerprint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 bg-surface-container-lowest font-mono-data text-[11px]">
                  {duplicates.map((dup, idx) => (
                    <tr key={idx} className="hover:bg-surface-bright/40">
                      <td className="py-2 px-3 text-center text-outline">#{dup.row}</td>
                      <td className="py-2 px-3 font-sans text-on-surface truncate max-w-[200px]">{dup.description}</td>
                      <td className="py-2 px-3 text-right text-on-surface">${dup.amount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-outline truncate max-w-[240px] text-[10px]">{dup.fingerprint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
