'use client';

import React from 'react';
import { CSVUploadZone } from '@/components/upload/CSVUploadZone';

export default function UploadPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12 w-full">
      {/* Header */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-mono-data uppercase tracking-wider text-secondary-fixed bg-primary px-2.5 py-0.5 rounded font-bold">
            Data Ingestion Engine
          </span>
          <span className="text-xs text-on-surface-variant font-medium">• CSV & Bank Sync</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
          Import Financial Data
        </h1>
        <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
          Import your bank statements, expense exports, or payroll CSVs. FundFlow parses, auto-categorizes, and grounds all metrics in your verified transaction ledger.
        </p>
      </div>

      {/* CSV Ingestion Component */}
      <CSVUploadZone />
    </div>
  );
}
