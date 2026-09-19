'use client';

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import {
  parseCsvText,
  validateCsvBatch,
  normalizeCandidateToTransaction,
  generateTransactionFingerprint,
  RawCsvRow,
  ColumnMapping,
  DateFormatPreference,
  ValidationSummary,
} from '@/lib/finance/data-pipeline';
import { Step1Upload } from './steps/Step1Upload';
import { Step2Parse } from './steps/Step2Parse';
import { Step3ColumnMapping } from './steps/Step3ColumnMapping';
import { Step4ValidationPreview } from './steps/Step4ValidationPreview';
import { Step5Confirmation } from './steps/Step5Confirmation';
import { Step6Persistence } from './steps/Step6Persistence';
import { Step7Completion } from './steps/Step7Completion';

type WorkflowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const CSVUploadZone: React.FC = () => {
  const { workspace, transactions: existingTransactions, importTransactions } = useFinance();

  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [fileName, setFileName] = useState<string>('import.csv');
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [, setRawContent] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawCsvRow[]>([]);
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [dateFormat, setDateFormat] = useState<DateFormatPreference>('AUTO');

  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
    debit: '',
    credit: '',
    category: '',
    type: '',
    merchant: '',
    external_reference: '',
  });

  const [completionResult, setCompletionResult] = useState<{
    importedCount: number;
    rejectedCount: number;
    duplicateCount: number;
    rejectedReasons: { row: number; reason: string }[];
    duplicates: { row: number; description: string; amount: number; fingerprint: string }[];
  }>({
    importedCount: 0,
    rejectedCount: 0,
    duplicateCount: 0,
    rejectedReasons: [],
    duplicates: [],
  });

  const existingFingerprints = useMemo(() => {
    const set = new Set<string>();
    for (const t of existingTransactions) {
      if (t.transaction_date && t.description && t.amount) {
        set.add(
          generateTransactionFingerprint(
            workspace.id,
            t.transaction_date,
            t.description,
            t.amount,
            t.transaction_type
          )
        );
      }
    }
    return set;
  }, [existingTransactions, workspace.id]);

  // Handle Step 1: File Loaded
  const handleFileLoaded = (file: File, content: string) => {
    try {
      setFileName(file.name);
      setFileSizeBytes(file.size);
      setRawContent(content);

      const parsed = parseCsvText(content);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setConfidences(parsed.confidences);

      setMapping({
        date: parsed.detectedMapping.date || '',
        description: parsed.detectedMapping.description || '',
        amount: parsed.detectedMapping.amount || '',
        debit: parsed.detectedMapping.debit || '',
        credit: parsed.detectedMapping.credit || '',
        category: parsed.detectedMapping.category || '',
        type: parsed.detectedMapping.type || '',
        merchant: parsed.detectedMapping.merchant || '',
        external_reference: parsed.detectedMapping.external_reference || '',
      });

      setCurrentStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Malformed CSV';
      alert(`Failed to parse CSV: ${msg}`);
    }
  };

  // Run validation
  const validationSummary: ValidationSummary = useMemo(() => {
    if (rows.length === 0 || !mapping.date || !mapping.description) {
      return {
        totalRecords: rows.length,
        validRecords: 0,
        invalidRecords: rows.length,
        missingCategories: 0,
        malformedDates: 0,
        malformedAmounts: 0,
        duplicateCandidates: 0,
        directionConflicts: 0,
        ambiguousDates: 0,
        issues: [],
        rowResults: [],
      };
    }

    return validateCsvBatch(rows, {
      mapping,
      dateFormatPreference: dateFormat,
      workspaceId: workspace.id,
      currency: workspace.currency || 'USD',
      existingFingerprints,
    });
  }, [rows, mapping, dateFormat, workspace.id, workspace.currency, existingFingerprints]);

  // Handle Step 6: Persistence
  const handleConfirmPersistence = async () => {
    setCurrentStep(6);

    try {
      const validCandidates = validationSummary.rowResults
        .filter((r) => r.isValid && r.candidate)
        .map((r) => r.candidate!);

      const normalizedTransactions = validCandidates.map((c) =>
        normalizeCandidateToTransaction(c, workspace.id)
      );

      // Collect pre-rejected and pre-duplicates from validation
      const preRejectedReasons: { row: number; reason: string }[] = [];
      const preDuplicates: { row: number; description: string; amount: number; fingerprint: string }[] = [];

      for (const r of validationSummary.rowResults) {
        if (r.status === 'duplicate') {
          preDuplicates.push({
            row: r.rowNumber,
            description: r.candidate?.description || `Transaction #${r.rowNumber}`,
            amount: r.candidate?.amount || 0,
            fingerprint: r.candidate?.fingerprint || '',
          });
        } else if (r.status === 'invalid') {
          for (const issue of r.issues) {
            if (issue.severity === 'error' || issue.code === 'AMBIGUOUS_DATE') {
              preRejectedReasons.push({ row: r.rowNumber, reason: issue.message });
            }
          }
        }
      }

      // Persist to Server API boundary
      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          transactions: normalizedTransactions,
          fileName,
          fileSizeBytes,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server error during transaction persistence.');
      }

      // Update local FinanceContext state
      await importTransactions(normalizedTransactions);

      const allRejected = [...preRejectedReasons, ...(data.rejected || [])];
      const allDuplicates = [...preDuplicates, ...(data.duplicates || [])];

      setCompletionResult({
        importedCount: data.importedCount ?? normalizedTransactions.length,
        rejectedCount: allRejected.length,
        duplicateCount: allDuplicates.length,
        rejectedReasons: allRejected,
        duplicates: allDuplicates,
      });

      setCurrentStep(7);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown persistence error';
      alert(`Persistence failed: ${msg}`);
      setCurrentStep(5);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setFileName('import.csv');
    setFileSizeBytes(0);
    setRawContent('');
    setHeaders([]);
    setRows([]);
    setDateFormat('AUTO');
  };

  const stepLabels: Record<WorkflowStep, string> = {
    1: '1. Upload',
    2: '2. Parse',
    3: '3. Map Columns',
    4: '4. Validate',
    5: '5. Confirm',
    6: '6. Persist',
    7: '7. Complete',
  };

  return (
    <div className="space-y-6">
      {/* Workflow Progress Stepper */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-sm">
        <div className="flex items-center justify-between overflow-x-auto pb-1 sm:pb-0 gap-2">
          {([1, 2, 3, 4, 5, 6, 7] as WorkflowStep[]).map((stepNum) => {
            const isCompleted = currentStep > stepNum;
            const isCurrent = currentStep === stepNum;

            return (
              <div
                key={stepNum}
                className={`flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold font-mono-data transition-colors ${
                  isCurrent
                    ? 'bg-primary text-on-primary shadow-xs'
                    : isCompleted
                    ? 'bg-secondary/15 text-secondary'
                    : 'text-on-surface-variant/60'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    isCurrent
                      ? 'bg-white text-primary'
                      : isCompleted
                      ? 'bg-secondary text-on-secondary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {isCompleted ? '✓' : stepNum}
                </span>
                <span>{stepLabels[stepNum]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Components */}
      {currentStep === 1 && (
        <Step1Upload
          onFileLoaded={handleFileLoaded}
          currency={workspace.currency || 'USD'}
        />
      )}

      {currentStep === 2 && (
        <Step2Parse
          fileName={fileName}
          fileSizeBytes={fileSizeBytes}
          headers={headers}
          sampleRows={rows}
          totalRawRows={rows.length}
          onProceed={() => setCurrentStep(3)}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && (
        <Step3ColumnMapping
          headers={headers}
          mapping={mapping}
          onChangeMapping={setMapping}
          dateFormatPreference={dateFormat}
          onChangeDateFormat={setDateFormat}
          confidences={confidences}
          sampleRow={rows[0]}
          onProceed={() => setCurrentStep(4)}
          onBack={() => setCurrentStep(2)}
          currency={workspace.currency || 'USD'}
        />
      )}

      {currentStep === 4 && (
        <Step4ValidationPreview
          summary={validationSummary}
          dateFormatPreference={dateFormat}
          onChangeDateFormat={setDateFormat}
          onProceed={() => setCurrentStep(5)}
          onBack={() => setCurrentStep(3)}
        />
      )}

      {currentStep === 5 && (
        <Step5Confirmation
          summary={validationSummary}
          workspaceName={workspace.name}
          currency={workspace.currency || 'USD'}
          onConfirm={handleConfirmPersistence}
          onBack={() => setCurrentStep(4)}
        />
      )}

      {currentStep === 6 && (
        <Step6Persistence
          totalToPersist={validationSummary.validRecords}
        />
      )}

      {currentStep === 7 && (
        <Step7Completion
          importedCount={completionResult.importedCount}
          rejectedCount={completionResult.rejectedCount}
          duplicateCount={completionResult.duplicateCount}
          rejectedReasons={completionResult.rejectedReasons}
          duplicates={completionResult.duplicates}
          onReset={handleReset}
          workspaceName={workspace.name}
          currency={workspace.currency || 'USD'}
        />
      )}
    </div>
  );
};
