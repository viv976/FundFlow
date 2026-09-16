import { Transaction, TransactionType, TransactionStatus, TransactionSource } from '@/types/finance';

export type DateFormatPreference = 'AUTO' | 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  category?: string;
  type?: string;
  merchant?: string;
  external_reference?: string;
  subcategory?: string;
}

export type RawCsvRow = Record<string, string>;

export type ValidationIssueCode =
  | 'DIRECTION_CONFLICT'
  | 'UNKNOWN_DIRECTION'
  | 'AMBIGUOUS_DATE'
  | 'MALFORMED_DATE'
  | 'MALFORMED_AMOUNT'
  | 'MISSING_REQUIRED'
  | 'DUPLICATE_CANDIDATE'
  | 'MISSING_CATEGORY';

export interface ValidationIssue {
  rowNumber: number;
  field: string;
  value?: string;
  message: string;
  severity: 'error' | 'warning';
  code: ValidationIssueCode;
}

export interface NormalizedCandidate {
  transaction_date: string; // YYYY-MM-DD
  description: string;
  merchant?: string;
  category: string;
  subcategory?: string;
  amount: number; // strictly positive finite number
  currency: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  source: TransactionSource;
  external_reference?: string;
  fingerprint: string;
  metadata?: Record<string, unknown>;
}

export type RowClassification = 'valid' | 'invalid' | 'duplicate';

export interface RowValidationResult {
  rowNumber: number;
  status: RowClassification;
  isValid: boolean;
  isDuplicate: boolean;
  isAmbiguousDate: boolean;
  issues: ValidationIssue[];
  candidate?: NormalizedCandidate;
}

export interface ValidationSummary {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  missingCategories: number;
  malformedDates: number;
  malformedAmounts: number;
  duplicateCandidates: number;
  directionConflicts: number;
  ambiguousDates: number;
  issues: ValidationIssue[];
  rowResults: RowValidationResult[];
}

export interface PipelineImportResult {
  totalProcessed: number;
  importedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  rejectedReasons: { row: number; reason: string; code?: ValidationIssueCode }[];
  duplicates: { row: number; description: string; amount: number; fingerprint: string }[];
  transactions: Transaction[];
}
