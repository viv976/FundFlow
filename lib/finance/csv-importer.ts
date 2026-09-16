import { Transaction, CSVImportResult } from '@/types/finance';
import {
  parseCsvText,
  validateCsvBatch,
  normalizeCandidateToTransaction,
  generateTransactionFingerprint,
  ColumnMapping,
  DateFormatPreference,
} from './data-pipeline';

export * from './data-pipeline';

export interface CSVParseOptions {
  mapping: {
    date: string;
    amount?: string;
    debit?: string;
    credit?: string;
    description: string;
    category?: string;
    account?: string;
    balance?: string;
    type?: string;
    merchant?: string;
    external_reference?: string;
  };
  dateFormat?: string; // 'AUTO' | 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY'
  currency?: string;
  existingTransactions?: Transaction[];
}

/**
 * Validates and parses CSV with comprehensive normalization, direction precedence,
 * date ambiguity handling, and deterministic deduplication.
 */
export function parseAndImportCSV(
  csvContent: string,
  workspaceId: string,
  options: CSVParseOptions
): CSVImportResult {
  const { mapping, dateFormat = 'AUTO', currency = 'USD', existingTransactions = [] } = options;

  const parsed = parseCsvText(csvContent);

  const existingFingerprints = new Set<string>();
  for (const t of existingTransactions) {
    if (t.transaction_date && t.description && t.amount) {
      existingFingerprints.add(
        generateTransactionFingerprint(
          workspaceId,
          t.transaction_date,
          t.description,
          t.amount,
          t.transaction_type
        )
      );
    }
  }

  const columnMapping: ColumnMapping = {
    date: mapping.date,
    description: mapping.description,
    amount: mapping.amount,
    debit: mapping.debit,
    credit: mapping.credit,
    category: mapping.category,
    type: mapping.type,
    merchant: mapping.merchant,
    external_reference: mapping.external_reference || mapping.account,
  };

  const validationSummary = validateCsvBatch(parsed.rows, {
    mapping: columnMapping,
    dateFormatPreference: dateFormat as DateFormatPreference,
    workspaceId,
    currency,
    existingFingerprints,
  });

  const transactions: Transaction[] = [];
  const errors: { row: number; reason: string }[] = [];
  let categorizedCount = 0;
  let uncategorizedCount = 0;

  for (const result of validationSummary.rowResults) {
    if (result.isValid && result.candidate) {
      const tx = normalizeCandidateToTransaction(result.candidate, workspaceId);
      if (tx.category && tx.category !== 'Uncategorized' && tx.category !== 'Other') {
        categorizedCount++;
      } else {
        uncategorizedCount++;
      }
      transactions.push(tx);
    } else {
      for (const issue of result.issues) {
        if (issue.severity === 'error' || issue.code === 'AMBIGUOUS_DATE') {
          errors.push({
            row: issue.rowNumber,
            reason: issue.message,
          });
        }
      }
    }
  }

  return {
    totalRows: parsed.rows.length,
    importedRows: transactions.length,
    categorizedRows: categorizedCount,
    uncategorizedRows: uncategorizedCount,
    skippedRows: validationSummary.duplicateCandidates,
    failedRows: errors.length,
    errors,
    transactions,
  };
}
