'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import {
  parseAndImportCSV,
  detectColumnMapping,
  sanitizeCSVValue,
  parseDate,
  parseAmount,
  DetectedMapping,
} from '@/lib/finance/csv-importer';
import { recordUploadedFileDb } from '@/lib/supabase/db';
import Papa from 'papaparse';

export const CSVUploadZone: React.FC = () => {
  const { workspace, transactions: existingTransactions, importTransactions } = useFinance();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentFileName, setCurrentFileName] = useState<string>('import.csv');
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [rawCSV, setRawCSV] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dateFormat, setDateFormat] = useState<string>('AUTO');

  // Mapping state
  const [mapping, setMapping] = useState<{
    date: string;
    amount: string;
    debit: string;
    credit: string;
    description: string;
    category: string;
    account: string;
    balance: string;
    type: string;
  }>({
    date: '',
    amount: '',
    debit: '',
    credit: '',
    description: '',
    category: '',
    account: '',
    balance: '',
    type: '',
  });

  const [confidences, setConfidences] = useState<Record<string, number>>({});

  const [importStatus, setImportStatus] = useState<{
    status: 'idle' | 'parsing' | 'ready' | 'importing' | 'success' | 'error';
    message?: string;
    total?: number;
    imported?: number;
    categorized?: number;
    uncategorized?: number;
    skipped?: number;
    failed?: number;
    errors?: { row: number; reason: string }[];
  }>({ status: 'idle' });

  const handleFile = (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportStatus({
        status: 'error',
        message: 'Invalid file format. Please upload a valid .csv file.',
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setImportStatus({
        status: 'error',
        message: 'File exceeds the 50MB limit. Please upload a smaller CSV.',
      });
      return;
    }

    setCurrentFileName(file.name);
    setFileSizeBytes(file.size);
    setImportStatus({ status: 'parsing', message: `Reading and parsing ${file.name}...` });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        setRawCSV(text);

        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          preview: 8,
          skipEmptyLines: 'greedy',
        });

        if (parsed.errors && parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
          throw new Error(parsed.errors[0]?.message || 'Malformed CSV format.');
        }

        const detectedHeaders = parsed.meta.fields || [];
        if (detectedHeaders.length === 0) {
          throw new Error('No header row or columns found in CSV.');
        }

        const detected = detectColumnMapping(detectedHeaders);

        setHeaders(detectedHeaders);
        setSampleRows(parsed.data);
        setConfidences(detected.confidences);

        // Intelligently assign detected mapping
        setMapping({
          date: detected.dateCol || detectedHeaders[0] || '',
          amount: detected.amountCol || '',
          debit: detected.debitCol || '',
          credit: detected.creditCol || '',
          description: detected.descriptionCol || (detectedHeaders.length > 1 ? detectedHeaders[1] : ''),
          category: detected.categoryCol || '',
          account: detected.accountCol || '',
          balance: detected.balanceCol || '',
          type: detected.typeCol || '',
        });

        setImportStatus({
          status: 'ready',
          message: `Loaded ${file.name} successfully (${detectedHeaders.length} columns detected). Review mapping and validation below.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown parsing error';
        setImportStatus({
          status: 'error',
          message: `Failed to parse CSV: ${msg}`,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Live pre-import validation calculations
  const validation = useMemo(() => {
    if (!rawCSV || sampleRows.length === 0) return null;

    const hasAmountOrDebitCredit = Boolean(mapping.amount || (mapping.debit || mapping.credit));
    const isMappable = Boolean(mapping.date && mapping.description && hasAmountOrDebitCredit);

    if (!isMappable) {
      return {
        isValid: false,
        warnings: ['Map required fields: Transaction Date, Memo/Description, and either Amount or Debit/Credit.'],
        sampleValid: 0,
        sampleInvalid: 0,
      };
    }

    let sampleValid = 0;
    let sampleInvalid = 0;
    const warnings: string[] = [];

    sampleRows.forEach((row, idx) => {
      const d = mapping.date ? parseDate(row[mapping.date], dateFormat) : { isValid: false };
      const hasAmt = mapping.amount ? parseAmount(row[mapping.amount]).isValid : false;
      const hasDeb = mapping.debit ? parseAmount(row[mapping.debit]).isValid : false;
      const hasCred = mapping.credit ? parseAmount(row[mapping.credit]).isValid : false;

      if (d.isValid && (hasAmt || hasDeb || hasCred)) {
        sampleValid++;
      } else {
        sampleInvalid++;
        if (idx < 2) {
          warnings.push(`Sample row #${idx + 1} validation flag: check date/amount format.`);
        }
      }
    });

    return {
      isValid: sampleValid > 0,
      warnings,
      sampleValid,
      sampleInvalid,
    };
  }, [rawCSV, sampleRows, mapping, dateFormat]);

  const handleConfirmImport = async () => {
    if (!rawCSV) return;

    try {
      setImportStatus({ status: 'importing', message: 'Processing, normalizing & storing transactions...' });

      const result = parseAndImportCSV(rawCSV, workspace.id, {
        mapping,
        dateFormat,
        currency: workspace.currency || 'USD',
        existingTransactions,
      });

      if (result.importedRows === 0) {
        setImportStatus({
          status: 'error',
          message: 'No valid transaction rows found in CSV to import.',
          failed: result.failedRows,
          errors: result.errors.slice(0, 5),
        });
        return;
      }

      // Store in Supabase / Local Context
      await importTransactions(result.transactions);

      // Record in Supabase uploaded_files table
      await recordUploadedFileDb(
        workspace.id,
        currentFileName,
        fileSizeBytes,
        result.importedRows
      );

      setImportStatus({
        status: 'success',
        total: result.totalRows,
        imported: result.importedRows,
        categorized: result.categorizedRows ?? 0,
        uncategorized: result.uncategorizedRows ?? 0,
        skipped: result.skippedRows ?? 0,
        failed: result.failedRows,
        message: 'Import complete',
      });

      // Clear raw inputs
      setRawCSV('');
      setHeaders([]);
      setSampleRows([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown import error';
      setImportStatus({
        status: 'error',
        message: `Import failed: ${msg}`,
      });
    }
  };

  const currencyCode = workspace.currency || 'USD';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Column: Upload & Mapping */}
      <div className="lg:col-span-2 flex flex-col gap-8">
        {/* Upload Zone */}
        <section className="glass-card rounded-xl p-8 bg-surface-container-lowest shadow-sm border border-outline-variant/60">
          <h2 className="font-headline-md text-headline-md text-primary mb-4 font-semibold flex items-center justify-between">
            <span>Upload CSV File</span>
            <span className="text-xs font-mono-data text-secondary-fixed bg-primary px-2.5 py-0.5 rounded font-bold">
              {currencyCode} Ledger
            </span>
          </h2>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`file-drop-area rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all border-2 border-dashed ${
              isDragOver
                ? 'border-primary bg-primary/5 scale-[0.99]'
                : 'border-outline-variant bg-surface-bright hover:border-primary/50'
            }`}
          >
            <span className="material-symbols-outlined text-4xl text-primary mb-3 text-[48px]">
              cloud_upload
            </span>
            <p className="font-body-md text-body-md text-on-surface font-semibold mb-1">
              Drag and drop your CSV file here
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-5">
              or click to browse from your computer
            </p>

            <input
              type="file"
              accept=".csv,text/csv"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            <button
              type="button"
              className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-label-md text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm cursor-pointer"
            >
              Select CSV File
            </button>
          </div>

          <div className="mt-3 flex justify-between items-center text-on-surface-variant font-body-sm text-xs">
            <span>Supported formats: .csv</span>
            <span>Max size: 50MB</span>
          </div>

          {/* Import Status Messages & Summary Banner */}
          {importStatus.status === 'success' && (
            <div className="mt-5 p-5 bg-secondary-container/30 border border-secondary/40 text-on-surface rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 text-secondary font-bold text-sm">
                <span className="material-symbols-outlined text-xl">check_circle</span>
                <span>Import complete</span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Your transactions have been validated, categorized, and added to your corporate ledger.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/60 text-center">
                  <span className="text-[10px] uppercase font-mono-data text-on-surface-variant block">Imported</span>
                  <span className="text-base font-bold text-secondary font-mono-data">+{importStatus.imported}</span>
                </div>
                <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/60 text-center">
                  <span className="text-[10px] uppercase font-mono-data text-on-surface-variant block">Categorized</span>
                  <span className="text-base font-bold text-primary font-mono-data">{importStatus.categorized}</span>
                </div>
                <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/60 text-center">
                  <span className="text-[10px] uppercase font-mono-data text-on-surface-variant block">Uncategorized</span>
                  <span className="text-base font-bold text-on-surface font-mono-data">{importStatus.uncategorized}</span>
                </div>
                <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/60 text-center">
                  <span className="text-[10px] uppercase font-mono-data text-on-surface-variant block">Skipped/Dupes</span>
                  <span className="text-base font-bold text-outline font-mono-data">{importStatus.skipped}</span>
                </div>
              </div>
            </div>
          )}

          {importStatus.status === 'error' && (
            <div className="mt-4 p-4 rounded-xl text-xs font-body-sm bg-error-container/40 text-error border border-error/30 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
              <div className="space-y-1">
                <p className="font-semibold">{importStatus.message}</p>
                {importStatus.errors && importStatus.errors.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] opacity-90">
                    {importStatus.errors.map((e, idx) => (
                      <li key={idx}>Row {e.row}: {e.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {importStatus.status === 'parsing' && (
            <div className="mt-4 p-3 rounded-xl text-xs bg-surface-container text-on-surface border border-outline-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-base animate-spin text-primary">progress_activity</span>
              <span>{importStatus.message}</span>
            </div>
          )}
        </section>

        {/* Mapping Preview Table */}
        <section className="glass-card rounded-xl p-8 bg-surface-container-lowest shadow-sm border border-outline-variant/60 flex-1 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary font-semibold">
                Data Mapping Preview
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                FundFlow auto-detects columns and maps them to your financial model.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span className="font-semibold text-on-surface">Date Format:</span>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-xs text-on-surface focus:border-primary cursor-pointer"
                >
                  <option value="AUTO">Auto-Detect</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 01/08/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/01/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-01)</option>
                </select>
              </div>

              <span
                className={`px-3 py-1 rounded text-label-md text-xs border font-semibold ${
                  headers.length > 0
                    ? 'bg-secondary-container text-on-secondary-container border-secondary/30'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant'
                }`}
              >
                {headers.length > 0 ? 'Ready to Map' : 'Awaiting Data'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-outline-variant rounded-xl w-full">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-surface text-on-surface font-label-md text-xs border-b border-outline-variant">
                <tr>
                  <th className="py-3 px-4 font-semibold w-56 whitespace-nowrap">FundFlow System Field</th>
                  <th className="py-3 px-4 font-semibold min-w-[240px]">Source CSV Column</th>
                  <th className="py-3 px-4 font-semibold w-36 whitespace-nowrap">Match Quality</th>
                  <th className="py-3 px-4 font-semibold min-w-[180px]">Sample Preview</th>
                </tr>
              </thead>

              <tbody className="text-body-sm text-sm text-on-surface-variant divide-y divide-outline-variant/60">
                {/* 1. Transaction Date */}
                <tr className="bg-surface-bright hover:bg-surface-container-low/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-on-surface whitespace-nowrap">
                    <span>Transaction Date</span>
                    <span className="text-error ml-1">*</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={mapping.date}
                      onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
                      disabled={headers.length === 0}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    {mapping.date ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-data font-semibold bg-secondary/15 text-secondary border border-secondary/30">
                        {confidences['date'] ? `${confidences['date']}% Match` : 'Mapped'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-outline font-mono-data">Unmapped</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono-data text-xs text-on-surface">
                    {mapping.date && sampleRows[0]?.[mapping.date] !== undefined
                      ? sanitizeCSVValue(sampleRows[0][mapping.date])
                      : '--'}
                  </td>
                </tr>

                {/* 2. Amount */}
                <tr className="bg-surface-bright hover:bg-surface-container-low/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-on-surface whitespace-nowrap">
                    <span>Amount ({currencyCode})</span>
                    {!mapping.debit && !mapping.credit && <span className="text-error ml-1">*</span>}
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={mapping.amount}
                      onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
                      disabled={headers.length === 0}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">-- Select Column (or use Debit/Credit below) --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    {mapping.amount ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-data font-semibold bg-secondary/15 text-secondary border border-secondary/30">
                        {confidences['amount'] ? `${confidences['amount']}% Match` : 'Mapped'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-outline font-mono-data">Optional / Split</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono-data text-xs text-on-surface">
                    {mapping.amount && sampleRows[0]?.[mapping.amount] !== undefined
                      ? sanitizeCSVValue(sampleRows[0][mapping.amount])
                      : '--'}
                  </td>
                </tr>

                {/* 3. Debit Column (Optional/Split) */}
                <tr className="bg-surface-bright hover:bg-surface-container-low/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-on-surface whitespace-nowrap">
                    <span>Debit / Withdrawal</span>
                    <span className="text-[10px] text-outline block font-normal font-sans">Becomes expense (-Amount)</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={mapping.debit}
                      onChange={(e) => setMapping({ ...mapping, debit: e.target.value })}
                      disabled={headers.length === 0}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">-- None / Use Net Amount --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    {mapping.debit ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-data font-semibold bg-secondary/15 text-secondary border border-secondary/30">
                        {confidences['debit'] ? `${confidences['debit']}% Match` : 'Mapped'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-outline font-mono-data">Unmapped</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono-data text-xs text-error font-semibold">
                    {mapping.debit && sampleRows[0]?.[mapping.debit] !== undefined
                      ? `-${sanitizeCSVValue(sampleRows[0][mapping.debit])}`
                      : '--'}
                  </td>
                </tr>

                {/* 4. Credit Column (Optional/Split) */}
                <tr className="bg-surface-bright hover:bg-surface-container-low/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-on-surface whitespace-nowrap">
                    <span>Credit / Deposit</span>
                    <span className="text-[10px] text-outline block font-normal font-sans">Becomes income (+Amount)</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={mapping.credit}
                      onChange={(e) => setMapping({ ...mapping, credit: e.target.value })}
                      disabled={headers.length === 0}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">-- None / Use Net Amount --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    {mapping.credit ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-data font-semibold bg-secondary/15 text-secondary border border-secondary/30">
                        {confidences['credit'] ? `${confidences['credit']}% Match` : 'Mapped'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-outline font-mono-data">Unmapped</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono-data text-xs text-secondary font-semibold">
                    {mapping.credit && sampleRows[0]?.[mapping.credit] !== undefined
                      ? `+${sanitizeCSVValue(sampleRows[0][mapping.credit])}`
                      : '--'}
                  </td>
                </tr>

                {/* 5. Memo / Description */}
                <tr className="bg-surface-bright hover:bg-surface-container-low/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-on-surface whitespace-nowrap">
                    <span>Memo / Description</span>
                    <span className="text-error ml-1">*</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={mapping.description}
                      onChange={(e) => setMapping({ ...mapping, description: e.target.value })}
                      disabled={headers.length === 0}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    {mapping.description ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-data font-semibold bg-secondary/15 text-secondary border border-secondary/30">
                        {confidences['description'] ? `${confidences['description']}% Match` : 'Mapped'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-outline font-mono-data">Unmapped</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-xs text-on-surface">
                    {mapping.description && sampleRows[0]?.[mapping.description] !== undefined
                      ? sanitizeCSVValue(sampleRows[0][mapping.description])
                      : '--'}
                  </td>
                </tr>

                {/* 6. Category (Optional) */}
                <tr className="bg-surface-bright hover:bg-surface-container-low/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-on-surface whitespace-nowrap">
                    <span>Category</span>
                    <span className="text-[10px] text-outline block font-normal font-sans">Optional / Auto-Rules</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={mapping.category}
                      onChange={(e) => setMapping({ ...mapping, category: e.target.value })}
                      disabled={headers.length === 0}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">-- Auto-Categorize by Rules --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    {mapping.category ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-data font-semibold bg-primary/15 text-primary border border-primary/30">
                        From CSV
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-data font-semibold bg-surface-container text-on-surface-variant border border-outline-variant">
                        Auto-Rules
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono-data text-xs text-on-surface-variant">
                    {mapping.category && sampleRows[0]?.[mapping.category] !== undefined
                      ? sanitizeCSVValue(sampleRows[0][mapping.category])
                      : 'Deterministic Rules'}
                  </td>
                </tr>

                {/* 7. Balance / Account */}
                <tr className="bg-surface-bright hover:bg-surface-container-low/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-on-surface whitespace-nowrap">
                    <span>Balance / Account</span>
                    <span className="text-[10px] text-outline block font-normal font-sans">Optional metadata</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={mapping.balance || mapping.account}
                      onChange={(e) => setMapping({ ...mapping, balance: e.target.value })}
                      disabled={headers.length === 0}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">-- None / Optional --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    {mapping.balance ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono-data font-semibold bg-secondary/15 text-secondary border border-secondary/30">
                        Mapped
                      </span>
                    ) : (
                      <span className="text-[11px] text-outline font-mono-data">Unmapped</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono-data text-xs text-on-surface">
                    {mapping.balance && sampleRows[0]?.[mapping.balance] !== undefined
                      ? sanitizeCSVValue(sampleRows[0][mapping.balance])
                      : '--'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Validation Pre-Import Notice */}
          {validation && (
            <div className="p-3.5 bg-surface-container-low border border-outline-variant rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-sm">verified</span>
                <span>
                  Validation status: <strong>{validation.sampleValid} sample rows valid</strong> across active mappings.
                </span>
              </div>
              <span className="text-on-surface-variant font-mono-data">
                Entity: {workspace.name} ({currencyCode})
              </span>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleConfirmImport}
              disabled={
                !rawCSV ||
                !mapping.date ||
                !mapping.description ||
                (!mapping.amount && !mapping.debit && !mapping.credit) ||
                importStatus.status === 'importing'
              }
              className="bg-primary text-on-primary px-8 py-3 rounded-xl font-label-md text-xs font-semibold hover:bg-primary-container transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {importStatus.status === 'importing' ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Importing Ledger Rows...</span>
                </>
              ) : (
                <>
                  <span>Confirm Mapping & Import</span>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      {/* Side Column */}
      <div className="flex flex-col gap-8">
        {/* Plaid Bank Sync (Coming Soon) */}
        <aside className="glass-card rounded-xl p-6 bg-surface-container relative overflow-hidden border-primary-fixed-dim border-2 shadow-sm">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-fixed rounded-full opacity-50 blur-2xl pointer-events-none"></div>
          <div className="relative z-10 space-y-3">
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-3xl text-primary">account_balance</span>
              <span className="bg-secondary-fixed text-on-secondary-fixed px-2.5 py-0.5 rounded text-[10px] font-label-md tracking-wider uppercase font-bold shadow-sm">
                Coming Soon
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary font-semibold">
              Connect Bank Account
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-xs leading-relaxed">
              Skip manual uploads. Link your corporate accounts directly for automated, real-time transaction reconciliation via open banking.
            </p>
            <button
              disabled
              className="w-full border border-primary text-primary px-4 py-2.5 rounded-xl font-label-md text-xs hover:bg-primary hover:text-on-primary transition-colors flex items-center justify-center gap-2 opacity-70 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">link</span>
              <span>Notify Me When Available</span>
            </button>
          </div>
        </aside>

        {/* Help & Formatting Tips */}
        <aside className="glass-card rounded-xl p-6 bg-surface-container-lowest space-y-3 shadow-sm border border-outline-variant/60">
          <h3 className="font-label-md text-label-md text-on-surface flex items-center gap-1.5 uppercase text-outline font-semibold text-xs">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>Formatting Guidelines</span>
          </h3>
          <ul className="space-y-2 font-body-sm text-body-sm text-on-surface-variant list-disc pl-4 text-xs leading-relaxed">
            <li>Ensure the header row is at the very top of your CSV.</li>
            <li>Supported date formats: <strong>DD/MM/YYYY</strong>, <strong>MM/DD/YYYY</strong>, or <strong>YYYY-MM-DD</strong>.</li>
            <li>Supports separate <strong>Debit</strong> and <strong>Credit</strong> columns as well as net Amount columns.</li>
            <li>Automatic deterministic categorization maps AWS, Stripe, Gusto, Google Ads, Adobe, WeWork, and travel expenses.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
};
