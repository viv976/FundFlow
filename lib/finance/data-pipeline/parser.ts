import Papa from 'papaparse';
import { RawCsvRow, ColumnMapping } from './types';

export interface ParseResult {
  headers: string[];
  rows: RawCsvRow[];
  detectedMapping: Partial<ColumnMapping>;
  confidences: Record<string, number>;
  totalRawRows: number;
}

/**
 * Sanitizes input string to prevent formula injection / XSS
 */
export function sanitizeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();

  // Prevent formula injection in spreadsheet viewers
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str.replace(/[<>]/g, '');
}

/**
 * Validates file type and size constraints
 */
export function validateFileConstraints(file: { name: string; size: number }): {
  isValid: boolean;
  error?: string;
} {
  if (!file) {
    return { isValid: false, error: 'No file provided.' };
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith('.csv')) {
    return { isValid: false, error: 'Invalid file extension. Please upload a .csv file.' };
  }

  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds the 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  return { isValid: true };
}

/**
 * Detects column mapping using keyword and regex heuristics without hardcoding
 */
export function detectColumnMapping(headers: string[]): {
  mapping: Partial<ColumnMapping>;
  confidences: Record<string, number>;
} {
  const mapping: Partial<ColumnMapping> = {};
  const confidences: Record<string, number> = {};

  for (const h of headers) {
    const raw = h.toLowerCase().trim();
    const norm = raw.replace(/[^a-z0-9]/g, '');

    // 1. Date Detection
    if (!mapping.date) {
      if (norm === 'date' || norm === 'transactiondate' || norm === 'posteddate' || norm === 'txndate') {
        mapping.date = h;
        confidences['date'] = 98;
      } else if (norm.includes('date') || norm.includes('posted') || norm.includes('time')) {
        mapping.date = h;
        confidences['date'] = 85;
      }
    }

    // 2. Debit Detection
    if (!mapping.debit) {
      if (norm === 'debit' || norm === 'debitamount' || norm === 'withdrawal' || norm === 'dr') {
        mapping.debit = h;
        confidences['debit'] = 96;
      } else if (norm.includes('debit') || norm.includes('withdraw') || norm.includes('paidout')) {
        mapping.debit = h;
        confidences['debit'] = 82;
      }
    }

    // 3. Credit Detection
    if (!mapping.credit) {
      if (norm === 'credit' || norm === 'creditamount' || norm === 'deposit' || norm === 'cr') {
        mapping.credit = h;
        confidences['credit'] = 96;
      } else if (norm.includes('credit') || norm.includes('deposit') || norm.includes('paidin')) {
        mapping.credit = h;
        confidences['credit'] = 82;
      }
    }

    // 4. Amount Detection (if not debit/credit)
    if (!mapping.amount && !mapping.debit) {
      if (norm === 'amount' || norm === 'transactionamount' || norm === 'netamount') {
        mapping.amount = h;
        confidences['amount'] = 95;
      } else if (norm.includes('amount') || norm.includes('total') || norm.includes('value')) {
        mapping.amount = h;
        confidences['amount'] = 80;
      }
    }

    // 5. Description / Memo Detection
    if (!mapping.description) {
      if (norm === 'description' || norm === 'memo' || norm === 'narration' || norm === 'particulars') {
        mapping.description = h;
        confidences['description'] = 97;
      } else if (
        norm.includes('desc') ||
        norm.includes('memo') ||
        norm.includes('detail') ||
        norm.includes('narrat') ||
        norm.includes('payee') ||
        norm.includes('merchant')
      ) {
        mapping.description = h;
        confidences['description'] = 85;
      }
    }

    // 6. Category Detection
    if (!mapping.category) {
      if (norm === 'category' || norm === 'classification' || norm === 'tag') {
        mapping.category = h;
        confidences['category'] = 92;
      } else if (norm.includes('category') || norm.includes('tag')) {
        mapping.category = h;
        confidences['category'] = 75;
      }
    }

    // 7. Transaction Type Detection
    if (!mapping.type) {
      if (norm === 'transactiontype' || norm === 'transtype' || norm === 'type' || norm === 'drcr') {
        mapping.type = h;
        confidences['type'] = 90;
      }
    }

    // 8. External Reference / Account Detection
    if (!mapping.external_reference) {
      if (norm === 'reference' || norm === 'ref' || norm === 'account' || norm === 'accountnumber' || norm === 'invoicenumber') {
        mapping.external_reference = h;
        confidences['external_reference'] = 88;
      }
    }
  }

  return { mapping, confidences };
}

/**
 * Safely parses raw CSV text into headers and row objects
 */
export function parseCsvText(csvContent: string): ParseResult {
  if (!csvContent || !csvContent.trim()) {
    throw new Error('CSV file content is empty.');
  }

  const parsed = Papa.parse<RawCsvRow>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  if (parsed.errors && parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    const firstErr = parsed.errors[0];
    throw new Error(`CSV syntax error at line ${firstErr.row ?? 'unknown'}: ${firstErr.message}`);
  }

  const headers = (parsed.meta.fields || []).map((h) => h.trim()).filter(Boolean);
  if (headers.length === 0) {
    throw new Error('No header row or valid columns found in CSV.');
  }

  // Filter out any rows that have completely empty string values across all fields
  const rows = (parsed.data as RawCsvRow[]).filter((row) => {
    const values = Object.values(row).map((v) => String(v ?? '').trim());
    return values.some((v) => v.length > 0);
  });

  const { mapping, confidences } = detectColumnMapping(headers);

  return {
    headers,
    rows,
    detectedMapping: mapping,
    confidences,
    totalRawRows: rows.length,
  };
}
