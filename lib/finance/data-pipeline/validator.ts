import {
  RawCsvRow,
  ColumnMapping,
  DateFormatPreference,
  ValidationSummary,
  RowValidationResult,
  ValidationIssue,
  NormalizedCandidate,
} from './types';
import { parseDateWithAmbiguity } from './date-parser';
import { resolveTransactionDirection } from './direction-resolver';
import { generateTransactionFingerprint } from './fingerprint';
import { sanitizeCSVValue } from './parser';

export interface ValidationOptions {
  mapping: ColumnMapping;
  dateFormatPreference?: DateFormatPreference;
  workspaceId: string;
  currency?: string;
  existingFingerprints?: Set<string>;
}

/**
 * Validates a batch of raw CSV rows against column mapping and active workspace rules.
 */
export function validateCsvBatch(
  rows: RawCsvRow[],
  options: ValidationOptions
): ValidationSummary {
  const {
    mapping,
    dateFormatPreference = 'AUTO',
    workspaceId,
    currency = 'USD',
    existingFingerprints = new Set<string>(),
  } = options;

  const rowResults: RowValidationResult[] = [];
  const allIssues: ValidationIssue[] = [];

  const seenBatchFingerprints = new Set<string>();

  let missingCategoriesCount = 0;
  let malformedDatesCount = 0;
  let malformedAmountsCount = 0;
  let directionConflictsCount = 0;
  let ambiguousDatesCount = 0;

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    const rowIssues: ValidationIssue[] = [];
    let isRowStructurallyValid = true;
    let isRowDuplicate = false;
    let isRowAmbiguous = false;

    // 1. DATE VALIDATION
    const rawDate = mapping.date ? row[mapping.date] : undefined;
    const dateResult = parseDateWithAmbiguity(rawDate, dateFormatPreference);

    if (dateResult.isAmbiguous) {
      isRowAmbiguous = true;
      ambiguousDatesCount++;
      rowIssues.push({
        rowNumber,
        field: 'date',
        value: String(rawDate ?? ''),
        message: dateResult.errorReason || 'Ambiguous date format.',
        severity: 'warning',
        code: 'AMBIGUOUS_DATE',
      });
      isRowStructurallyValid = false;
    } else if (!dateResult.isValid || !dateResult.isoDate) {
      malformedDatesCount++;
      isRowStructurallyValid = false;
      rowIssues.push({
        rowNumber,
        field: 'date',
        value: String(rawDate ?? ''),
        message: dateResult.errorReason || 'Invalid or missing transaction date.',
        severity: 'error',
        code: 'MALFORMED_DATE',
      });
    }

    // 2. DESCRIPTION VALIDATION
    const rawDesc = mapping.description ? row[mapping.description] : undefined;
    const sanitizedDesc = sanitizeCSVValue(rawDesc);
    if (!sanitizedDesc) {
      isRowStructurallyValid = false;
      rowIssues.push({
        rowNumber,
        field: 'description',
        value: String(rawDesc ?? ''),
        message: 'Transaction description or memo cannot be blank.',
        severity: 'error',
        code: 'MISSING_REQUIRED',
      });
    }

    // 3. DIRECTION RESOLUTION & AMOUNT VALIDATION
    const rawAmount = mapping.amount ? row[mapping.amount] : undefined;
    const rawDebit = mapping.debit ? row[mapping.debit] : undefined;
    const rawCredit = mapping.credit ? row[mapping.credit] : undefined;
    const rawType = mapping.type ? row[mapping.type] : undefined;

    const directionResult = resolveTransactionDirection({
      rawAmount,
      rawDebit,
      rawCredit,
      rawType,
    });

    if (!directionResult.isValid) {
      isRowStructurallyValid = false;
      if (directionResult.error.code === 'DIRECTION_CONFLICT') {
        directionConflictsCount++;
        rowIssues.push({
          rowNumber,
          field: 'amount/type',
          message: directionResult.error.message,
          severity: 'error',
          code: 'DIRECTION_CONFLICT',
        });
      } else if (directionResult.error.code === 'MALFORMED_AMOUNT') {
        malformedAmountsCount++;
        rowIssues.push({
          rowNumber,
          field: 'amount',
          value: String(rawAmount || rawDebit || rawCredit || ''),
          message: directionResult.error.message,
          severity: 'error',
          code: 'MALFORMED_AMOUNT',
        });
      } else {
        rowIssues.push({
          rowNumber,
          field: 'amount',
          message: directionResult.error.message,
          severity: 'error',
          code: 'UNKNOWN_DIRECTION',
        });
      }
    }

    // 4. CATEGORY EVALUATION
    const rawCategory = mapping.category ? row[mapping.category] : undefined;
    const sanitizedCategory = sanitizeCSVValue(rawCategory);
    if (!sanitizedCategory || sanitizedCategory.toLowerCase() === 'uncategorized' || sanitizedCategory.toLowerCase() === 'other') {
      missingCategoriesCount++;
      rowIssues.push({
        rowNumber,
        field: 'category',
        value: sanitizedCategory || 'None',
        message: 'Category missing or unmapped; deterministic accounting rules will apply.',
        severity: 'warning',
        code: 'MISSING_CATEGORY',
      });
    }

    // 5. DUPLICATE FINGERPRINT CHECK
    let candidate: NormalizedCandidate | undefined;

    if (isRowStructurallyValid && dateResult.isoDate && directionResult.isValid) {
      const fingerprint = generateTransactionFingerprint(
        workspaceId,
        dateResult.isoDate,
        sanitizedDesc,
        directionResult.amount,
        directionResult.transactionType
      );

      const isIntraBatchDuplicate = seenBatchFingerprints.has(fingerprint);
      const isExistingDuplicate = existingFingerprints.has(fingerprint);

      if (isIntraBatchDuplicate || isExistingDuplicate) {
        isRowDuplicate = true;
        rowIssues.push({
          rowNumber,
          field: 'record',
          message: isIntraBatchDuplicate
            ? 'Duplicate transaction within the same CSV file.'
            : 'Duplicate candidate matching existing ledger record in this workspace.',
          severity: 'warning',
          code: 'DUPLICATE_CANDIDATE',
        });
      } else {
        seenBatchFingerprints.add(fingerprint);
      }

      // Merchant and External Reference
      const rawMerchant = mapping.merchant ? row[mapping.merchant] : undefined;
      const merchant = rawMerchant ? sanitizeCSVValue(rawMerchant) : undefined;

      const rawRef = mapping.external_reference ? row[mapping.external_reference] : undefined;
      const external_reference = rawRef ? sanitizeCSVValue(rawRef) : undefined;

      candidate = {
        transaction_date: dateResult.isoDate,
        description: sanitizedDesc,
        merchant,
        category: sanitizedCategory || 'Uncategorized',
        subcategory: mapping.subcategory ? sanitizeCSVValue(row[mapping.subcategory]) : undefined,
        amount: directionResult.amount,
        currency,
        transaction_type: directionResult.transactionType,
        status: 'completed',
        source: 'csv_import',
        external_reference,
        fingerprint,
        metadata: {
          csvRowNumber: rowNumber,
        },
      };
    }

    // Mutually exclusive status determination
    let status: 'valid' | 'invalid' | 'duplicate';
    if (!isRowStructurallyValid) {
      status = 'invalid';
    } else if (isRowDuplicate) {
      status = 'duplicate';
    } else {
      status = 'valid';
    }

    allIssues.push(...rowIssues);
    rowResults.push({
      rowNumber,
      status,
      isValid: status === 'valid',
      isDuplicate: status === 'duplicate',
      isAmbiguousDate: isRowAmbiguous,
      issues: rowIssues,
      candidate,
    });
  });

  const validRecords = rowResults.filter((r) => r.status === 'valid').length;
  const duplicateCandidates = rowResults.filter((r) => r.status === 'duplicate').length;
  const invalidRecords = rowResults.filter((r) => r.status === 'invalid').length;

  return {
    totalRecords: rows.length,
    validRecords,
    invalidRecords,
    missingCategories: missingCategoriesCount,
    malformedDates: malformedDatesCount,
    malformedAmounts: malformedAmountsCount,
    duplicateCandidates,
    directionConflicts: directionConflictsCount,
    ambiguousDates: ambiguousDatesCount,
    issues: allIssues,
    rowResults,
  };
}
