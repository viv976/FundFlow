'use client';

import React from 'react';
import { ColumnMapping, DateFormatPreference, RawCsvRow } from '@/lib/finance/data-pipeline/types';

interface Step3ColumnMappingProps {
  headers: string[];
  mapping: ColumnMapping;
  onChangeMapping: (updated: ColumnMapping) => void;
  dateFormatPreference: DateFormatPreference;
  onChangeDateFormat: (format: DateFormatPreference) => void;
  confidences: Record<string, number>;
  sampleRow?: RawCsvRow;
  onProceed: () => void;
  onBack: () => void;
  currency: string;
}

export const Step3ColumnMapping: React.FC<Step3ColumnMappingProps> = ({
  headers,
  mapping,
  onChangeMapping,
  dateFormatPreference,
  onChangeDateFormat,
  confidences,
  sampleRow,
  onProceed,
  onBack,
  currency,
}) => {
  const hasAmountSignal = Boolean(mapping.amount || mapping.debit || mapping.credit);
  const isMappable = Boolean(mapping.date && mapping.description && hasAmountSignal);

  const updateField = (field: keyof ColumnMapping, value: string) => {
    onChangeMapping({
      ...mapping,
      [field]: value || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-5">
          <div>
            <span className="text-[10px] uppercase font-mono-data font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
              Mapping & Calibration
            </span>
            <h2 className="text-xl font-bold text-on-surface font-headline-md mt-1">
              Step 3: Map Columns & Format Configuration
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Map your CSV columns to FundFlow ledger fields. No column names are assumed.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-outline-variant text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors"
            >
              Back
            </button>
            <button
              onClick={onProceed}
              disabled={!isMappable}
              className="px-6 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Validate Dataset</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Global Date Format Preference */}
        <div className="p-4 bg-surface-bright border border-outline-variant/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
            <div>
              <span className="text-xs font-bold text-on-surface block">Date Format Resolution</span>
              <span className="text-[11px] text-on-surface-variant">
                Select an explicit date format to prevent day/month ambiguity (e.g. 01/02/2026).
              </span>
            </div>
          </div>
          <select
            value={dateFormatPreference}
            onChange={(e) => onChangeDateFormat(e.target.value as DateFormatPreference)}
            className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:border-primary font-mono-data cursor-pointer"
          >
            <option value="AUTO">Auto-Detect (Ambiguous dates flagged for review)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 01/08/2026 = 1st August)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/01/2026 = 1st August)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-01)</option>
          </select>
        </div>

        {/* Mapping Table */}
        <div className="overflow-x-auto border border-outline-variant/60 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-surface-bright text-on-surface font-semibold border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 w-52">FundFlow Field</th>
                <th className="py-3 px-4 min-w-[240px]">Source CSV Column</th>
                <th className="py-3 px-4 w-32 whitespace-nowrap">Match Confidence</th>
                <th className="py-3 px-4 min-w-[180px]">Sample Data Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40 bg-surface-container-lowest">
              {/* 1. Transaction Date */}
              <tr className="hover:bg-surface-bright/50">
                <td className="py-3.5 px-4 font-semibold text-on-surface">
                  <span>Transaction Date</span>
                  <span className="text-error ml-1">*</span>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    value={mapping.date || ''}
                    onChange={(e) => updateField('date', e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary cursor-pointer"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px]">
                  {mapping.date && confidences['date'] ? (
                    <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-semibold">
                      {confidences['date']}% Match
                    </span>
                  ) : mapping.date ? (
                    <span className="text-outline">Manual</span>
                  ) : (
                    <span className="text-error font-semibold">Required</span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px] text-on-surface truncate">
                  {mapping.date && sampleRow ? sampleRow[mapping.date] || '—' : '—'}
                </td>
              </tr>

              {/* 2. Description */}
              <tr className="hover:bg-surface-bright/50">
                <td className="py-3.5 px-4 font-semibold text-on-surface">
                  <span>Description / Memo</span>
                  <span className="text-error ml-1">*</span>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    value={mapping.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary cursor-pointer"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px]">
                  {mapping.description && confidences['description'] ? (
                    <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-semibold">
                      {confidences['description']}% Match
                    </span>
                  ) : mapping.description ? (
                    <span className="text-outline">Manual</span>
                  ) : (
                    <span className="text-error font-semibold">Required</span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-[11px] text-on-surface truncate">
                  {mapping.description && sampleRow ? sampleRow[mapping.description] || '—' : '—'}
                </td>
              </tr>

              {/* 3. Amount */}
              <tr className="hover:bg-surface-bright/50">
                <td className="py-3.5 px-4 font-semibold text-on-surface">
                  <span>Amount ({currency})</span>
                  {!mapping.debit && !mapping.credit && <span className="text-error ml-1">*</span>}
                  <span className="text-[10px] text-outline block font-normal font-sans">Single signed/unsigned amount</span>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    value={mapping.amount || ''}
                    onChange={(e) => updateField('amount', e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary cursor-pointer"
                  >
                    <option value="">-- Select Column (or use Debit/Credit below) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px]">
                  {mapping.amount && confidences['amount'] ? (
                    <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-semibold">
                      {confidences['amount']}% Match
                    </span>
                  ) : (
                    <span className="text-outline">Optional / Split</span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px] text-on-surface truncate">
                  {mapping.amount && sampleRow ? sampleRow[mapping.amount] || '—' : '—'}
                </td>
              </tr>

              {/* 4. Debit Column */}
              <tr className="hover:bg-surface-bright/50">
                <td className="py-3.5 px-4 font-semibold text-on-surface">
                  <span>Debit Column</span>
                  <span className="text-[10px] text-outline block font-normal font-sans">Resolved to expense</span>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    value={mapping.debit || ''}
                    onChange={(e) => updateField('debit', e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary cursor-pointer"
                  >
                    <option value="">-- None / Use Amount Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px]">
                  {mapping.debit && confidences['debit'] ? (
                    <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-semibold">
                      {confidences['debit']}% Match
                    </span>
                  ) : (
                    <span className="text-outline">Optional</span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px] text-error truncate">
                  {mapping.debit && sampleRow ? `-${sampleRow[mapping.debit]}` : '—'}
                </td>
              </tr>

              {/* 5. Credit Column */}
              <tr className="hover:bg-surface-bright/50">
                <td className="py-3.5 px-4 font-semibold text-on-surface">
                  <span>Credit Column</span>
                  <span className="text-[10px] text-outline block font-normal font-sans">Resolved to income</span>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    value={mapping.credit || ''}
                    onChange={(e) => updateField('credit', e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary cursor-pointer"
                  >
                    <option value="">-- None / Use Amount Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px]">
                  {mapping.credit && confidences['credit'] ? (
                    <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-semibold">
                      {confidences['credit']}% Match
                    </span>
                  ) : (
                    <span className="text-outline">Optional</span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px] text-secondary truncate">
                  {mapping.credit && sampleRow ? `+${sampleRow[mapping.credit]}` : '—'}
                </td>
              </tr>

              {/* 6. Transaction Type */}
              <tr className="hover:bg-surface-bright/50">
                <td className="py-3.5 px-4 font-semibold text-on-surface">
                  <span>Transaction Type</span>
                  <span className="text-[10px] text-outline block font-normal font-sans">Explicit Income / Expense signal</span>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    value={mapping.type || ''}
                    onChange={(e) => updateField('type', e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary cursor-pointer"
                  >
                    <option value="">-- None / Derived from Amount or Debit/Credit --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px]">
                  {mapping.type && confidences['type'] ? (
                    <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-semibold">
                      {confidences['type']}% Match
                    </span>
                  ) : (
                    <span className="text-outline">Optional</span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px] text-on-surface truncate">
                  {mapping.type && sampleRow ? sampleRow[mapping.type] || '—' : '—'}
                </td>
              </tr>

              {/* 7. Category */}
              <tr className="hover:bg-surface-bright/50">
                <td className="py-3.5 px-4 font-semibold text-on-surface">
                  <span>Category</span>
                  <span className="text-[10px] text-outline block font-normal font-sans">Optional / Rules apply if unmapped</span>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    value={mapping.category || ''}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary cursor-pointer"
                  >
                    <option value="">-- Apply Deterministic Accounting Rules --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px]">
                  {mapping.category && confidences['category'] ? (
                    <span className="px-2 py-0.5 rounded bg-primary/15 text-primary font-semibold">
                      From CSV
                    </span>
                  ) : (
                    <span className="text-outline">Auto-Rules</span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px] text-on-surface truncate">
                  {mapping.category && sampleRow ? sampleRow[mapping.category] || 'Deterministic Rules' : 'Deterministic Rules'}
                </td>
              </tr>

              {/* 8. Merchant / Vendor */}
              <tr className="hover:bg-surface-bright/50">
                <td className="py-3.5 px-4 font-semibold text-on-surface">
                  <span>Merchant / Counterparty</span>
                  <span className="text-[10px] text-outline block font-normal font-sans">Optional vendor info</span>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    value={mapping.merchant || ''}
                    onChange={(e) => updateField('merchant', e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary cursor-pointer"
                  >
                    <option value="">-- None / Optional --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px] text-outline">
                  Optional
                </td>
                <td className="py-3.5 px-4 text-[11px] text-on-surface truncate">
                  {mapping.merchant && sampleRow ? sampleRow[mapping.merchant] || '—' : '—'}
                </td>
              </tr>

              {/* 9. External Reference / Account */}
              <tr className="hover:bg-surface-bright/50">
                <td className="py-3.5 px-4 font-semibold text-on-surface">
                  <span>Reference / Account</span>
                  <span className="text-[10px] text-outline block font-normal font-sans">Invoice # or Account Name</span>
                </td>
                <td className="py-3.5 px-4">
                  <select
                    value={mapping.external_reference || ''}
                    onChange={(e) => updateField('external_reference', e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary cursor-pointer"
                  >
                    <option value="">-- None / Optional --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px] text-outline">
                  Optional
                </td>
                <td className="py-3.5 px-4 font-mono-data text-[11px] text-on-surface truncate">
                  {mapping.external_reference && sampleRow ? sampleRow[mapping.external_reference] || '—' : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
