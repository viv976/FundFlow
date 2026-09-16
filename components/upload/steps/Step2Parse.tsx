'use client';

import React from 'react';
import { RawCsvRow } from '@/lib/finance/data-pipeline/types';

interface Step2ParseProps {
  fileName: string;
  fileSizeBytes: number;
  headers: string[];
  sampleRows: RawCsvRow[];
  totalRawRows: number;
  onProceed: () => void;
  onBack: () => void;
}

export const Step2Parse: React.FC<Step2ParseProps> = ({
  fileName,
  fileSizeBytes,
  headers,
  sampleRows,
  totalRawRows,
  onProceed,
  onBack,
}) => {
  const formattedSize =
    fileSizeBytes < 1024 * 1024
      ? `${(fileSizeBytes / 1024).toFixed(1)} KB`
      : `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-mono-data font-bold text-secondary bg-secondary/15 px-2 py-0.5 rounded">
                Parsed Successfully
              </span>
              <span className="text-xs text-on-surface-variant font-mono-data">{fileName}</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface font-headline-md">
              Step 2: Inspect Detected Columns & Structure
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-outline-variant text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors"
            >
              Choose Different File
            </button>
            <button
              onClick={onProceed}
              className="px-6 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Proceed to Column Mapping</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* File Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-surface-bright rounded-xl border border-outline-variant/50">
            <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Total Rows</span>
            <span className="text-lg font-bold text-on-surface font-mono-data">{totalRawRows}</span>
          </div>
          <div className="p-4 bg-surface-bright rounded-xl border border-outline-variant/50">
            <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Detected Columns</span>
            <span className="text-lg font-bold text-primary font-mono-data">{headers.length}</span>
          </div>
          <div className="p-4 bg-surface-bright rounded-xl border border-outline-variant/50">
            <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">File Size</span>
            <span className="text-lg font-bold text-on-surface font-mono-data">{formattedSize}</span>
          </div>
          <div className="p-4 bg-surface-bright rounded-xl border border-outline-variant/50">
            <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">File Format</span>
            <span className="text-lg font-bold text-secondary font-mono-data">RFC 4180 CSV</span>
          </div>
        </div>

        {/* Detected Columns Badges */}
        <div>
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2.5">
            Detected Source Columns ({headers.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {headers.map((h) => (
              <span
                key={h}
                className="px-3 py-1 bg-surface-container-high text-on-surface text-xs font-mono-data rounded-lg border border-outline-variant flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[14px] text-outline">view_column</span>
                <span>{h}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Raw Preview Table */}
        <div>
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2.5">
            Raw CSV Preview (First {sampleRows.length} Rows)
          </h3>
          <div className="overflow-x-auto border border-outline-variant/60 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-bright border-b border-outline-variant text-on-surface font-semibold">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center text-outline">#</th>
                  {headers.map((h) => (
                    <th key={h} className="py-2.5 px-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40 bg-surface-container-lowest font-mono-data text-[11px]">
                {sampleRows.slice(0, 5).map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-bright/50">
                    <td className="py-2 px-3 text-center text-outline">{idx + 1}</td>
                    {headers.map((h) => (
                      <td key={h} className="py-2 px-3 whitespace-nowrap text-on-surface max-w-[200px] truncate">
                        {row[h] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
