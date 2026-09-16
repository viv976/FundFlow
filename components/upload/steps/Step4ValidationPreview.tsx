'use client';

import React, { useState } from 'react';
import { ValidationSummary, DateFormatPreference } from '@/lib/finance/data-pipeline/types';

interface Step4ValidationPreviewProps {
  summary: ValidationSummary;
  dateFormatPreference: DateFormatPreference;
  onChangeDateFormat: (format: DateFormatPreference) => void;
  onProceed: () => void;
  onBack: () => void;
}

export const Step4ValidationPreview: React.FC<Step4ValidationPreviewProps> = ({
  summary,
  dateFormatPreference,
  onChangeDateFormat,
  onProceed,
  onBack,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'ERRORS' | 'WARNINGS' | 'DUPLICATES' | 'AMBIGUOUS'>('ALL');

  const filteredIssues = summary.issues.filter((issue) => {
    if (filter === 'ERRORS') return issue.severity === 'error';
    if (filter === 'WARNINGS') return issue.severity === 'warning';
    if (filter === 'DUPLICATES') return issue.code === 'DUPLICATE_CANDIDATE';
    if (filter === 'AMBIGUOUS') return issue.code === 'AMBIGUOUS_DATE';
    return true;
  });

  const canProceed = summary.validRecords > 0;

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-mono-data font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                Pre-Ingestion Diagnostics
              </span>
              <span className="text-xs text-on-surface-variant font-medium">Validation Boundary</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface font-headline-md">
              Step 4: Validation Preview & Integrity Verification
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Review dataset health before persistence. Invalid or duplicate records will never be silently imported.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-outline-variant text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors"
            >
              Adjust Mapping
            </button>
            <button
              onClick={onProceed}
              disabled={!canProceed}
              className="px-6 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Review Confirmation ({summary.validRecords} Valid)</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Ambiguous Date Banner if present */}
        {summary.ambiguousDates > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-on-surface text-xs space-y-2 animate-fadeIn">
            <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-base">warning</span>
              <span>{summary.ambiguousDates} Ambiguous Date Records Detected</span>
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              Dates with day and month both $\le 12$ (e.g. <code>01/02/2026</code>) cannot be silently guessed under Auto-Detect.
              Select an explicit date format to disambiguate:
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onChangeDateFormat('DD/MM/YYYY')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-mono-data transition-colors ${
                  dateFormatPreference === 'DD/MM/YYYY'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container'
                }`}
              >
                Resolve as DD/MM/YYYY (Day first)
              </button>
              <button
                type="button"
                onClick={() => onChangeDateFormat('MM/DD/YYYY')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-mono-data transition-colors ${
                  dateFormatPreference === 'MM/DD/YYYY'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container'
                }`}
              >
                Resolve as MM/DD/YYYY (Month first)
              </button>
            </div>
          </div>
        )}

        {/* Diagnostic Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-surface-bright rounded-xl border border-outline-variant/60">
            <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Total Records</span>
            <span className="text-2xl font-bold text-on-surface font-mono-data">{summary.totalRecords}</span>
          </div>

          <div className="p-4 bg-surface-bright rounded-xl border border-secondary/40">
            <span className="text-[10px] font-mono-data uppercase text-secondary font-semibold block">Valid Records</span>
            <span className="text-2xl font-bold text-secondary font-mono-data">{summary.validRecords}</span>
            <span className="text-[10px] text-on-surface-variant block mt-0.5">Ready for ledger</span>
          </div>

          <div className="p-4 bg-surface-bright rounded-xl border border-error/40">
            <span className="text-[10px] font-mono-data uppercase text-error font-semibold block">Invalid Records</span>
            <span className="text-2xl font-bold text-error font-mono-data">{summary.invalidRecords}</span>
            <span className="text-[10px] text-on-surface-variant block mt-0.5">Excluded from import</span>
          </div>

          <div className="p-4 bg-surface-bright rounded-xl border border-outline-variant/60">
            <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Duplicates</span>
            <span className="text-2xl font-bold text-outline font-mono-data">{summary.duplicateCandidates}</span>
            <span className="text-[10px] text-on-surface-variant block mt-0.5">Will be skipped</span>
          </div>
        </div>

        {/* Detailed Breakdown Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-data">
          <div className="p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/40 flex justify-between items-center">
            <span className="text-on-surface-variant text-[11px]">Malformed Dates:</span>
            <span className={`font-bold ${summary.malformedDates > 0 ? 'text-error' : 'text-on-surface'}`}>
              {summary.malformedDates}
            </span>
          </div>
          <div className="p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/40 flex justify-between items-center">
            <span className="text-on-surface-variant text-[11px]">Malformed Amounts:</span>
            <span className={`font-bold ${summary.malformedAmounts > 0 ? 'text-error' : 'text-on-surface'}`}>
              {summary.malformedAmounts}
            </span>
          </div>
          <div className="p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/40 flex justify-between items-center">
            <span className="text-on-surface-variant text-[11px]">Missing Categories:</span>
            <span className={`font-bold ${summary.missingCategories > 0 ? 'text-amber-500' : 'text-on-surface'}`}>
              {summary.missingCategories}
            </span>
          </div>
          <div className="p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/40 flex justify-between items-center">
            <span className="text-on-surface-variant text-[11px]">Direction Conflicts:</span>
            <span className={`font-bold ${summary.directionConflicts > 0 ? 'text-error' : 'text-on-surface'}`}>
              {summary.directionConflicts}
            </span>
          </div>
        </div>

        {/* Issue Filter Chips */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Diagnostic Issues & Warnings ({summary.issues.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-data font-semibold transition-colors ${
                  filter === 'ALL'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-bright text-on-surface-variant border border-outline-variant'
                }`}
              >
                All ({summary.issues.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('ERRORS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-data font-semibold transition-colors ${
                  filter === 'ERRORS'
                    ? 'bg-error text-on-error'
                    : 'bg-surface-bright text-error border border-error/30'
                }`}
              >
                Errors ({summary.issues.filter((i) => i.severity === 'error').length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('WARNINGS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-data font-semibold transition-colors ${
                  filter === 'WARNINGS'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-bright text-secondary border border-secondary/30'
                }`}
              >
                Warnings ({summary.issues.filter((i) => i.severity === 'warning').length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('DUPLICATES')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-data font-semibold transition-colors ${
                  filter === 'DUPLICATES'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-bright text-on-surface border border-outline-variant'
                }`}
              >
                Duplicates ({summary.duplicateCandidates})
              </button>
            </div>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="p-8 text-center bg-surface-bright rounded-xl border border-outline-variant/60 text-on-surface-variant text-xs">
              <span className="material-symbols-outlined text-3xl text-secondary mb-1 block">verified</span>
              No issues match the selected filter.
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto border border-outline-variant/60 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-bright border-b border-outline-variant text-on-surface sticky top-0 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-16 text-center">Row</th>
                    <th className="py-2.5 px-3 w-28">Severity</th>
                    <th className="py-2.5 px-3 w-28">Field</th>
                    <th className="py-2.5 px-3">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 bg-surface-container-lowest font-mono-data text-[11px]">
                  {filteredIssues.map((issue, idx) => (
                    <tr key={idx} className="hover:bg-surface-bright/50">
                      <td className="py-2.5 px-3 text-center text-outline">#{issue.rowNumber}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            issue.severity === 'error'
                              ? 'bg-error-container text-error'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {issue.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-on-surface font-semibold">{issue.field}</td>
                      <td className="py-2.5 px-3 text-on-surface-variant font-sans text-xs">
                        {issue.message}
                        {issue.value && (
                          <span className="ml-1.5 font-mono-data text-[10px] bg-surface-container px-1.5 py-0.5 rounded text-outline">
                            val: &quot;{issue.value}&quot;
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
