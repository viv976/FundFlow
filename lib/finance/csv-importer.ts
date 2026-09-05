import Papa from 'papaparse';
import { Transaction, CSVImportResult } from '@/types/finance';

/**
 * Deterministic categorization rules matching standard business accounting
 */
export const CATEGORY_RULES: { keywords: string[]; category: string; isIncome?: boolean }[] = [
  {
    keywords: [
      'aws',
      'amazon web services',
      'google cloud',
      'gcp',
      'azure',
      'digitalocean',
      'vercel',
      'cloudflare',
      'datadog',
      'mongodb',
      'heroku',
      'redis',
      'render',
      'supabase',
      'neon',
    ],
    category: 'Cloud Infrastructure',
    isIncome: false,
  },
  {
    keywords: [
      'stripe',
      'client wire',
      'payout',
      'customer payment',
      'customer revenue',
      'shopify',
      'subscription revenue',
      'invoice paid',
      'deposit',
      'wire transfer in',
      'acme corp',
      'pilot customer',
      'orbit systems',
      'northstar inc',
      'vertex labs',
      'revenue',
    ],
    category: 'Customer Revenue',
    isIncome: true,
  },
  {
    keywords: [
      'gusto',
      'rippling',
      'deel',
      'payroll',
      'salary',
      'salaries',
      'wages',
      'bonus',
      'direct deposit payroll',
      'compensation',
      'employee',
    ],
    category: 'Payroll',
    isIncome: false,
  },
  {
    keywords: [
      'adobe',
      'adobe creative cloud',
      'github',
      'slack',
      'figma',
      'notion',
      'linear',
      'zoom',
      'openai',
      'anthropic',
      'hubspot',
      'atlassian',
      'jira',
      'google workspace',
      'gsuite',
      'microsoft 365',
      'office 365',
      'docker',
      'postman',
      'sentry',
      '1password',
    ],
    category: 'SaaS & Software',
    isIncome: false,
  },
  {
    keywords: [
      'google ads',
      'meta ads',
      'facebook ads',
      'linkedin ads',
      'twitter ads',
      'x ads',
      'advertising',
      'marketing',
      'agency fee',
      'sponsorship',
      'campaign',
      'adwords',
    ],
    category: 'Marketing',
    isIncome: false,
  },
  {
    keywords: [
      'wework',
      'office rent',
      'real estate',
      'coworking',
      'landlord',
      'facilities',
      'lease',
      'rent',
      'office space',
    ],
    category: 'Rent & Office',
    isIncome: false,
  },
  {
    keywords: [
      'contractor',
      'freelance',
      'upwork',
      'fiverr',
      'consultant',
      'design agency',
      'contractors',
    ],
    category: 'Contractors',
    isIncome: false,
  },
  {
    keywords: [
      'legal',
      'lawyer',
      'law firm',
      'cpa',
      'accounting',
      'tax',
      'audit',
      'incorporation',
      'delaware',
      'professional services',
      'consulting',
      'notary',
    ],
    category: 'Legal & Professional',
    isIncome: false,
  },
  {
    keywords: [
      'delta',
      'united',
      'american airlines',
      'uber',
      'lyft',
      'airbnb',
      'flight',
      'hotel',
      'expedia',
      'railway',
      'train',
      'travel',
      'airline',
    ],
    category: 'Travel',
    isIncome: false,
  },
];

export interface DetectedMapping {
  dateCol?: string;
  amountCol?: string;
  debitCol?: string;
  creditCol?: string;
  descriptionCol?: string;
  categoryCol?: string;
  accountCol?: string;
  balanceCol?: string;
  typeCol?: string;
  confidences: Record<string, number>;
}

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
  };
  dateFormat?: string; // 'AUTO' | 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY'
  currency?: string;
  existingTransactions?: Transaction[];
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  errors: { row: number; reason: string }[];
  warnings: string[];
}

/**
 * Generate a standard RFC4122 v4 UUID
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
 * Parse monetary amount string into a clean numeric float with sign detection
 */
export function parseAmount(val: string | number | undefined | null): {
  amount: number;
  isNegative: boolean;
  isValid: boolean;
} {
  if (val === undefined || val === null) {
    return { amount: 0, isNegative: false, isValid: false };
  }

  if (typeof val === 'number') {
    if (isNaN(val)) return { amount: 0, isNegative: false, isValid: false };
    return { amount: Math.abs(val), isNegative: val < 0, isValid: true };
  }

  let str = String(val).trim();
  if (!str) {
    return { amount: 0, isNegative: false, isValid: false };
  }

  // Check parentheses format: e.g. (1,245.00) => negative
  const isParenNegative = /^\(.*\)$/.test(str);
  if (isParenNegative) {
    str = str.replace(/^\((.*)\)$/, '$1');
  }

  // Remove currency signs, commas, extra whitespace
  const cleaned = str.replace(/[$€£₹CA$AU$SG$¥,\s]/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return { amount: 0, isNegative: false, isValid: false };
  }

  const isNegative = isParenNegative || parsed < 0 || str.startsWith('-');
  return { amount: Math.abs(parsed), isNegative, isValid: true };
}

/**
 * Parse date string into standard ISO YYYY-MM-DD format with multi-format detection
 */
export function parseDate(
  val: string | undefined | null,
  formatHint: string = 'AUTO'
): { date: string; isValid: boolean } {
  const fallback = new Date().toISOString().substring(0, 10);
  if (!val || typeof val !== 'string') {
    return { date: fallback, isValid: false };
  }

  const clean = val.trim();
  if (!clean) {
    return { date: fallback, isValid: false };
  }

  // ISO Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { date: clean, isValid: true };
    }
  }

  // Split by slashes, dashes, or dots
  const parts = clean.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let p0 = parts[0];
    let p1 = parts[1];
    let p2 = parts[2];

    // Case 1: YYYY/MM/DD
    if (p0.length === 4) {
      const year = p0;
      const month = p1.padStart(2, '0');
      const day = p2.padStart(2, '0');
      const mNum = parseInt(month, 10);
      const dNum = parseInt(day, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        return { date: `${year}-${month}-${day}`, isValid: true };
      }
    }

    // Two-digit or four-digit year in position 2
    let year = p2;
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }

    const num0 = parseInt(p0, 10);
    const num1 = parseInt(p1, 10);

    // Format hint explicit check
    if (formatHint === 'DD/MM/YYYY' || (formatHint === 'AUTO' && num0 > 12)) {
      // Day is definitely position 0, Month is position 1
      const day = p0.padStart(2, '0');
      const month = p1.padStart(2, '0');
      if (num1 >= 1 && num1 <= 12 && num0 >= 1 && num0 <= 31) {
        return { date: `${year}-${month}-${day}`, isValid: true };
      }
    } else if (formatHint === 'MM/DD/YYYY' || (formatHint === 'AUTO' && num1 > 12)) {
      // Month is position 0, Day is position 1
      const month = p0.padStart(2, '0');
      const day = p1.padStart(2, '0');
      if (num0 >= 1 && num0 <= 12 && num1 >= 1 && num1 <= 31) {
        return { date: `${year}-${month}-${day}`, isValid: true };
      }
    } else {
      // Default standard fallback: if both <= 12, assume DD/MM/YYYY for international or MM/DD/YYYY
      const day = p0.padStart(2, '0');
      const month = p1.padStart(2, '0');
      return { date: `${year}-${month}-${day}`, isValid: true };
    }
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return { date: parsed.toISOString().substring(0, 10), isValid: true };
  }

  return { date: fallback, isValid: false };
}

/**
 * Deterministically categorize transaction based on description & merchant keywords
 */
export function categorizeTransaction(
  description: string,
  merchant?: string,
  defaultType: 'income' | 'expense' = 'expense'
): {
  category: string;
  type: 'income' | 'expense';
  isCategorized: boolean;
} {
  const text = `${description || ''} ${merchant || ''}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return {
          category: rule.category,
          type: rule.isIncome ? 'income' : defaultType,
          isCategorized: true,
        };
      }
    }
  }

  return {
    category: 'Uncategorized',
    type: defaultType,
    isCategorized: false,
  };
}

/**
 * Intelligent header mapper with confidence scoring
 */
export function detectColumnMapping(headers: string[]): DetectedMapping {
  const mapping: DetectedMapping = {
    confidences: {},
  };

  for (const h of headers) {
    const raw = h.toLowerCase().trim();
    const norm = raw.replace(/[^a-z0-9]/g, '');

    // 1. Date Detection
    if (!mapping.dateCol) {
      if (norm === 'date' || norm === 'transactiondate' || norm === 'posteddate' || norm === 'txndate') {
        mapping.dateCol = h;
        mapping.confidences['date'] = 98;
      } else if (norm.includes('date') || norm.includes('time') || norm.includes('posted')) {
        mapping.dateCol = h;
        mapping.confidences['date'] = 85;
      }
    }

    // 2. Debit Detection
    if (!mapping.debitCol) {
      if (norm === 'debit' || norm === 'debitamount' || norm === 'withdrawal' || norm === 'withdrawals' || norm === 'dr') {
        mapping.debitCol = h;
        mapping.confidences['debit'] = 96;
      } else if (norm.includes('debit') || norm.includes('withdraw') || norm.includes('paidout')) {
        mapping.debitCol = h;
        mapping.confidences['debit'] = 82;
      }
    }

    // 3. Credit Detection
    if (!mapping.creditCol) {
      if (norm === 'credit' || norm === 'creditamount' || norm === 'deposit' || norm === 'deposits' || norm === 'cr') {
        mapping.creditCol = h;
        mapping.confidences['credit'] = 96;
      } else if (norm.includes('credit') || norm.includes('deposit') || norm.includes('paidin')) {
        mapping.creditCol = h;
        mapping.confidences['credit'] = 82;
      }
    }

    // 4. Amount Detection
    if (!mapping.amountCol && !mapping.debitCol) {
      if (norm === 'amount' || norm === 'transactionamount' || norm === 'netamount') {
        mapping.amountCol = h;
        mapping.confidences['amount'] = 95;
      } else if (norm.includes('amount') || norm.includes('total') || norm.includes('value') || norm.includes('sum')) {
        mapping.amountCol = h;
        mapping.confidences['amount'] = 80;
      }
    }

    // 5. Description / Memo Detection
    if (!mapping.descriptionCol) {
      if (norm === 'description' || norm === 'memo' || norm === 'narration' || norm === 'details' || norm === 'particulars') {
        mapping.descriptionCol = h;
        mapping.confidences['description'] = 97;
      } else if (norm.includes('desc') || norm.includes('memo') || norm.includes('detail') || norm.includes('narrat') || norm.includes('title') || norm.includes('payee') || norm.includes('merchant')) {
        mapping.descriptionCol = h;
        mapping.confidences['description'] = 85;
      }
    }

    // 6. Category Detection
    if (!mapping.categoryCol) {
      if (norm === 'category' || norm === 'classification' || norm === 'tag') {
        mapping.categoryCol = h;
        mapping.confidences['category'] = 92;
      } else if (norm.includes('category') || norm.includes('type') || norm.includes('tag')) {
        mapping.categoryCol = h;
        mapping.confidences['category'] = 75;
      }
    }

    // 7. Balance Detection
    if (!mapping.balanceCol) {
      if (norm === 'balance' || norm === 'closingbalance' || norm === 'runningbalance' || norm === 'availablebalance') {
        mapping.balanceCol = h;
        mapping.confidences['balance'] = 95;
      } else if (norm.includes('balance')) {
        mapping.balanceCol = h;
        mapping.confidences['balance'] = 80;
      }
    }

    // 8. Account Detection
    if (!mapping.accountCol) {
      if (norm === 'account' || norm === 'accountname' || norm === 'accountnumber' || norm === 'card') {
        mapping.accountCol = h;
        mapping.confidences['account'] = 90;
      } else if (norm.includes('account') || norm.includes('bank') || norm.includes('card')) {
        mapping.accountCol = h;
        mapping.confidences['account'] = 75;
      }
    }

    // 9. Transaction Type Detection
    if (!mapping.typeCol) {
      if (norm === 'transactiontype' || norm === 'transtype' || norm === 'drcr') {
        mapping.typeCol = h;
        mapping.confidences['type'] = 90;
      }
    }
  }

  return mapping;
}

/**
 * Validates and parses CSV with comprehensive normalization, debit/credit splitting, and multi-tenancy tags
 */
export function parseAndImportCSV(
  csvContent: string,
  workspaceId: string,
  options: CSVParseOptions
): CSVImportResult {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  const rows = (result.data as Record<string, string>[]).filter((r) => {
    // Filter out rows that have only whitespace across all keys
    const values = Object.values(r).map((v) => String(v || '').trim());
    return values.some((v) => v.length > 0);
  });

  const { mapping, dateFormat = 'AUTO', currency = 'USD', existingTransactions = [] } = options;

  const transactions: Transaction[] = [];
  const errors: { row: number; reason: string }[] = [];
  let categorizedCount = 0;
  let uncategorizedCount = 0;
  let skippedCount = 0;

  // Build existing signature set to identify exact duplicates within workspace
  const existingSignatures = new Set(
    existingTransactions.map(
      (t) => `${t.transaction_date}_${(t.description || '').toLowerCase()}_${t.amount}_${t.transaction_type}`
    )
  );

  rows.forEach((row, index) => {
    const rowNum = index + 1;

    try {
      // 1. Date extraction
      const rawDate = mapping.date ? row[mapping.date] : undefined;
      const { date, isValid: isDateValid } = parseDate(rawDate, dateFormat);

      if (!isDateValid && !rawDate) {
        errors.push({ row: rowNum, reason: `Missing required transaction date.` });
        return;
      }

      // 2. Description extraction
      const rawDesc = mapping.description ? row[mapping.description] : undefined;
      const description = sanitizeCSVValue(rawDesc || `Transaction #${rowNum}`);
      if (!rawDesc && !mapping.amount && !mapping.debit && !mapping.credit) {
        errors.push({ row: rowNum, reason: `Empty row data.` });
        return;
      }

      // 3. Amount and Debit/Credit extraction
      let finalAmount = 0;
      let finalType: 'income' | 'expense' = 'expense';
      let isAmountFound = false;

      const hasDebitCredit = Boolean(mapping.debit || mapping.credit);

      if (hasDebitCredit) {
        const rawDebit = mapping.debit ? row[mapping.debit] : undefined;
        const rawCredit = mapping.credit ? row[mapping.credit] : undefined;

        const debitParsed = parseAmount(rawDebit);
        const creditParsed = parseAmount(rawCredit);

        if (debitParsed.isValid && debitParsed.amount > 0) {
          finalAmount = debitParsed.amount;
          finalType = 'expense';
          isAmountFound = true;
        } else if (creditParsed.isValid && creditParsed.amount > 0) {
          finalAmount = creditParsed.amount;
          finalType = 'income';
          isAmountFound = true;
        }
      }

      // Fallback to single Amount column if debit/credit not matched or not mapped
      if (!isAmountFound && mapping.amount) {
        const rawAmt = row[mapping.amount];
        const amtParsed = parseAmount(rawAmt);

        if (amtParsed.isValid) {
          finalAmount = amtParsed.amount;
          finalType = amtParsed.isNegative ? 'expense' : 'income';
          isAmountFound = true;
        }
      }

      // Check transaction type column override if mapped
      if (mapping.type && row[mapping.type]) {
        const tStr = String(row[mapping.type]).toLowerCase().trim();
        if (tStr.includes('dr') || tStr.includes('debit') || tStr.includes('expense') || tStr.includes('out')) {
          finalType = 'expense';
        } else if (tStr.includes('cr') || tStr.includes('credit') || tStr.includes('income') || tStr.includes('in')) {
          finalType = 'income';
        }
      }

      if (!isAmountFound) {
        errors.push({ row: rowNum, reason: `No valid amount, debit, or credit found.` });
        return;
      }

      // 4. Category determination
      let category = mapping.category && row[mapping.category] ? sanitizeCSVValue(row[mapping.category]) : '';

      if (category && category !== 'Uncategorized' && category !== 'Other') {
        categorizedCount++;
      } else {
        const auto = categorizeTransaction(description, undefined, finalType);
        category = auto.category;
        if (auto.isCategorized) {
          categorizedCount++;
        } else {
          uncategorizedCount++;
        }
      }

      // 5. Account & External Reference
      let accountName = 'Operating Account';
      if (mapping.account && row[mapping.account]) {
        accountName = sanitizeCSVValue(row[mapping.account]);
      } else if (mapping.balance && row[mapping.balance]) {
        accountName = `Closing Bal: ${sanitizeCSVValue(row[mapping.balance])}`;
      }

      // 6. Check Duplicate
      const txSig = `${date}_${description.toLowerCase()}_${finalAmount}_${finalType}`;
      if (existingSignatures.has(txSig)) {
        skippedCount++;
        // We continue and do not re-import the exact duplicate
        return;
      }

      const tx: Transaction = {
        id: generateUUID(),
        workspace_id: workspaceId,
        transaction_date: date,
        description,
        category: category || 'Uncategorized',
        amount: finalAmount,
        currency: currency || 'USD',
        transaction_type: finalType,
        status: 'completed',
        source: 'csv_import',
        external_reference: accountName,
        created_at: new Date().toISOString(),
      };

      transactions.push(tx);
    } catch (rowErr) {
      const msg = rowErr instanceof Error ? rowErr.message : 'Malformed row';
      errors.push({ row: rowNum, reason: msg });
    }
  });

  return {
    totalRows: rows.length,
    importedRows: transactions.length,
    categorizedRows: categorizedCount,
    uncategorizedRows: uncategorizedCount,
    skippedRows: skippedCount,
    failedRows: errors.length,
    errors,
    transactions,
  };
}
