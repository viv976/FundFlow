/**
 * FundFlow Foundation Validation Module
 * Standardizes validation boundaries across transactions, CSV ingestion,
 * workspace identifiers, AI inputs, and financial metrics without external dependencies.
 */

import { TransactionType, TransactionStatus, TransactionSource } from '@/types/finance';
import {
  SUPPORTED_INDUSTRIES,
  SupportedIndustry,
  DEFAULT_CURRENCY,
  DEFAULT_INDUSTRY,
  DEFAULT_STARTING_CASH,
  DEFAULT_RUNWAY_ALERT_THRESHOLD,
} from '@/lib/finance/calculator';

export {
  SUPPORTED_INDUSTRIES,
  type SupportedIndustry,
  DEFAULT_CURRENCY,
  DEFAULT_INDUSTRY,
  DEFAULT_STARTING_CASH,
  DEFAULT_RUNWAY_ALERT_THRESHOLD,
};

export interface ValidationSuccess<T> {
  isValid: true;
  data: T;
  errors?: never;
}

export interface ValidationFailure {
  isValid: false;
  data?: never;
  errors: { field: string; message: string }[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * UUID v4 validator
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

/**
 * Validates ISO date string YYYY-MM-DD
 */
export function isValidISODate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export const SUPPORTED_CURRENCY_CODES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'INR',
  'SGD',
  'JPY',
] as const;

export type SupportedCurrencyCode = typeof SUPPORTED_CURRENCY_CODES[number];

/**
 * Sanitizes and extracts a 3-letter standard currency code
 */
export function sanitizeCurrency(currencyInput?: unknown): string {
  if (typeof currencyInput !== 'string') return 'USD';
  const match = currencyInput.match(/\b([A-Z]{3})\b/i);
  const code = (match ? match[1] : currencyInput).trim().toUpperCase();
  if (SUPPORTED_CURRENCY_CODES.includes(code as SupportedCurrencyCode)) {
    return code;
  }
  return code.length === 3 ? code : 'USD';
}

/**
 * Input payload for single transaction creation / mutation
 */
export interface ValidatedTransactionInput {
  description: string;
  merchant?: string;
  amount: number;
  category: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  transaction_date: string;
  currency: string;
  source: TransactionSource;
  external_reference?: string;
}

/**
 * Validates transaction payload before persistence
 */
export function validateTransactionInput(raw: unknown): ValidationResult<ValidatedTransactionInput> {
  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'transaction', message: 'Transaction payload must be an object' }],
    };
  }

  const obj = raw as Record<string, unknown>;
  const errors: { field: string; message: string }[] = [];

  // Description
  const rawDesc = obj.description;
  let description = '';
  if (typeof rawDesc !== 'string' || !rawDesc.trim()) {
    errors.push({ field: 'description', message: 'Description is required and cannot be blank' });
  } else {
    description = rawDesc.trim().slice(0, 500);
  }

  // Amount
  const rawAmount = obj.amount;
  const numAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount));
  if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be a positive finite number greater than zero' });
  }

  // Type
  const rawType = obj.transaction_type;
  const validTypes: TransactionType[] = ['income', 'expense'];
  if (rawType && !validTypes.includes(rawType as TransactionType)) {
    errors.push({ field: 'transaction_type', message: 'transaction_type must be either income or expense' });
  }
  const transaction_type: TransactionType = validTypes.includes(rawType as TransactionType)
    ? (rawType as TransactionType)
    : 'expense';

  // Category
  const rawCat = obj.category;
  const category = typeof rawCat === 'string' && rawCat.trim() ? rawCat.trim().slice(0, 100) : 'Other';

  // Transaction Date
  const rawDate = obj.transaction_date;
  let transaction_date = new Date().toISOString().substring(0, 10);
  if (rawDate) {
    if (isValidISODate(rawDate)) {
      transaction_date = String(rawDate);
    } else {
      errors.push({ field: 'transaction_date', message: 'Transaction date must be in YYYY-MM-DD format' });
    }
  }

  // Status
  const rawStatus = obj.status;
  const validStatuses: TransactionStatus[] = ['completed', 'pending', 'failed', 'reconciled'];
  let status: TransactionStatus = 'completed';
  if (rawStatus !== undefined && rawStatus !== null) {
    if (validStatuses.includes(rawStatus as TransactionStatus)) {
      status = rawStatus as TransactionStatus;
    } else {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }
  }

  // Source
  const rawSource = obj.source;
  const validSources: TransactionSource[] = ['manual', 'csv_import', 'plaid_sync'];
  const source: TransactionSource = validSources.includes(rawSource as TransactionSource)
    ? (rawSource as TransactionSource)
    : 'manual';

  // Currency
  const currency = sanitizeCurrency(obj.currency);

  // Merchant & External Reference
  const merchant = typeof obj.merchant === 'string' && obj.merchant.trim() ? obj.merchant.trim().slice(0, 200) : undefined;
  const external_reference =
    typeof obj.external_reference === 'string' && obj.external_reference.trim()
      ? obj.external_reference.trim().slice(0, 200)
      : undefined;

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      description,
      merchant,
      amount: Math.abs(numAmount),
      category,
      transaction_type,
      status,
      transaction_date,
      currency,
      source,
      external_reference,
    },
  };
}

/**
 * Validates workspace creation inputs
 */
export interface ValidatedWorkspaceInput {
  name: string;
  currency: string;
  industry: SupportedIndustry;
  startingCash: number;
  alertRunwayThreshold: number;
  userId?: string;
}

export function validateWorkspaceInput(raw: unknown): ValidationResult<ValidatedWorkspaceInput> {
  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'workspace', message: 'Workspace payload must be an object' }],
    };
  }

  const obj = raw as Record<string, unknown>;
  const errors: { field: string; message: string }[] = [];

  const rawName = obj.name;
  if (typeof rawName !== 'string' || !rawName.trim()) {
    errors.push({ field: 'name', message: 'Company or Workspace name is required' });
  }
  const name = typeof rawName === 'string' ? rawName.trim().slice(0, 150) : '';

  // Starting cash: finite non-negative number, default 0
  let startingCash = DEFAULT_STARTING_CASH;
  if (obj.startingCash !== undefined && obj.startingCash !== null && String(obj.startingCash).trim() !== '') {
    const parsed = typeof obj.startingCash === 'number' ? obj.startingCash : Number(obj.startingCash);
    if (!Number.isFinite(parsed) || isNaN(parsed) || parsed < 0) {
      errors.push({ field: 'startingCash', message: 'Starting cash must be a non-negative finite number' });
    } else {
      startingCash = parsed;
    }
  }

  // Runway threshold: 1–60 months, default 6
  let alertRunwayThreshold = DEFAULT_RUNWAY_ALERT_THRESHOLD;
  const rawThreshold = obj.alertRunwayThreshold ?? obj.runwayThreshold;
  if (rawThreshold !== undefined && rawThreshold !== null && String(rawThreshold).trim() !== '') {
    const parsed = typeof rawThreshold === 'number' ? rawThreshold : Number(rawThreshold);
    if (!Number.isFinite(parsed) || isNaN(parsed) || parsed < 1 || parsed > 60) {
      errors.push({ field: 'alertRunwayThreshold', message: 'Runway threshold must be between 1 and 60 months' });
    } else {
      alertRunwayThreshold = parsed;
    }
  }

  // Currency: supported currency code, default USD
  let currency = DEFAULT_CURRENCY;
  const rawCurrency = obj.currency;
  if (rawCurrency !== undefined && rawCurrency !== null && String(rawCurrency).trim() !== '') {
    if (typeof rawCurrency !== 'string') {
      errors.push({ field: 'currency', message: 'Currency must be a string' });
    } else {
      const match = rawCurrency.match(/\b([A-Z]{3})\b/i);
      const code = (match ? match[1] : rawCurrency).trim().toUpperCase();
      if (!SUPPORTED_CURRENCY_CODES.includes(code as SupportedCurrencyCode)) {
        errors.push({
          field: 'currency',
          message: `Unsupported currency code. Supported currencies: ${SUPPORTED_CURRENCY_CODES.join(', ')}`,
        });
      } else {
        currency = code;
      }
    }
  }

  // Industry: supported industry, default Technology & SaaS
  let industry: SupportedIndustry = DEFAULT_INDUSTRY;
  const rawIndustry = obj.industry;
  if (rawIndustry !== undefined && rawIndustry !== null && String(rawIndustry).trim() !== '') {
    if (typeof rawIndustry !== 'string') {
      errors.push({ field: 'industry', message: 'Industry must be a string' });
    } else {
      const trimmed = rawIndustry.trim();
      if (!SUPPORTED_INDUSTRIES.includes(trimmed as SupportedIndustry)) {
        errors.push({
          field: 'industry',
          message: `Unsupported industry. Supported industries: ${SUPPORTED_INDUSTRIES.join(', ')}`,
        });
      } else {
        industry = trimmed as SupportedIndustry;
      }
    }
  }

  const rawUserId = obj.userId;
  const userId = typeof rawUserId === 'string' && isValidUUID(rawUserId) ? rawUserId : undefined;

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      name,
      currency,
      industry,
      startingCash,
      alertRunwayThreshold,
      userId,
    },
  };
}

/**
 * Validates user signup inputs
 */
export interface ValidatedSignupInput {
  fullName: string;
  companyName: string;
  email: string;
  password: string;
  currency: string;
  industry: SupportedIndustry;
  startingCash: number;
  alertRunwayThreshold: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupInput(raw: unknown): ValidationResult<ValidatedSignupInput> {
  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'signup', message: 'Signup payload must be an object' }],
    };
  }

  const obj = raw as Record<string, unknown>;
  const errors: { field: string; message: string }[] = [];

  // Full Name
  const rawFullName = obj.fullName;
  if (typeof rawFullName !== 'string' || !rawFullName.trim()) {
    errors.push({ field: 'fullName', message: 'Full name is required' });
  }
  const fullName = typeof rawFullName === 'string' ? rawFullName.trim().slice(0, 100) : '';

  // Company / Business Name
  const rawCompanyName = obj.companyName;
  if (typeof rawCompanyName !== 'string' || !rawCompanyName.trim()) {
    errors.push({ field: 'companyName', message: 'Business / Company name is required' });
  }
  const companyName = typeof rawCompanyName === 'string' ? rawCompanyName.trim().slice(0, 150) : '';

  // Email
  const rawEmail = obj.email;
  let email = '';
  if (typeof rawEmail !== 'string' || !rawEmail.trim()) {
    errors.push({ field: 'email', message: 'Email address is required' });
  } else {
    email = rawEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      errors.push({ field: 'email', message: 'A valid email address is required' });
    }
  }

  // Password
  const rawPassword = obj.password;
  if (typeof rawPassword !== 'string' || rawPassword.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters long' });
  } else if (rawPassword.length > 128) {
    errors.push({ field: 'password', message: 'Password exceeds maximum length (128 characters)' });
  }
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  // Currency (optional, defaults to USD if omitted for backward compatibility)
  let currency = DEFAULT_CURRENCY;
  const rawCurrency = obj.currency;
  if (rawCurrency !== undefined && rawCurrency !== null && String(rawCurrency).trim() !== '') {
    if (typeof rawCurrency !== 'string') {
      errors.push({ field: 'currency', message: 'Currency must be a string' });
    } else {
      const match = rawCurrency.match(/\b([A-Z]{3})\b/i);
      const code = (match ? match[1] : rawCurrency).trim().toUpperCase();
      if (!SUPPORTED_CURRENCY_CODES.includes(code as SupportedCurrencyCode)) {
        errors.push({
          field: 'currency',
          message: `Unsupported currency code. Supported currencies: ${SUPPORTED_CURRENCY_CODES.join(', ')}`,
        });
      } else {
        currency = code;
      }
    }
  }

  // Industry (optional, defaults to Technology & SaaS for backward compatibility)
  let industry: SupportedIndustry = DEFAULT_INDUSTRY;
  const rawIndustry = obj.industry;
  if (rawIndustry !== undefined && rawIndustry !== null && String(rawIndustry).trim() !== '') {
    if (typeof rawIndustry !== 'string') {
      errors.push({ field: 'industry', message: 'Industry must be a string' });
    } else {
      const trimmed = rawIndustry.trim();
      if (!SUPPORTED_INDUSTRIES.includes(trimmed as SupportedIndustry)) {
        errors.push({
          field: 'industry',
          message: `Unsupported industry. Supported industries: ${SUPPORTED_INDUSTRIES.join(', ')}`,
        });
      } else {
        industry = trimmed as SupportedIndustry;
      }
    }
  }

  // Starting cash (optional, defaults to 0 for backward compatibility)
  let startingCash = DEFAULT_STARTING_CASH;
  if (obj.startingCash !== undefined && obj.startingCash !== null && String(obj.startingCash).trim() !== '') {
    const parsed = typeof obj.startingCash === 'number' ? obj.startingCash : Number(obj.startingCash);
    if (!Number.isFinite(parsed) || isNaN(parsed) || parsed < 0) {
      errors.push({ field: 'startingCash', message: 'Starting cash must be a non-negative finite number' });
    } else {
      startingCash = parsed;
    }
  }

  // Runway threshold (optional, defaults to 6 for backward compatibility)
  let alertRunwayThreshold = DEFAULT_RUNWAY_ALERT_THRESHOLD;
  const rawThreshold = obj.alertRunwayThreshold ?? obj.runwayThreshold;
  if (rawThreshold !== undefined && rawThreshold !== null && String(rawThreshold).trim() !== '') {
    const parsed = typeof rawThreshold === 'number' ? rawThreshold : Number(rawThreshold);
    if (!Number.isFinite(parsed) || isNaN(parsed) || parsed < 1 || parsed > 60) {
      errors.push({ field: 'alertRunwayThreshold', message: 'Runway threshold must be between 1 and 60 months' });
    } else {
      alertRunwayThreshold = parsed;
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      fullName,
      companyName,
      email,
      password,
      currency,
      industry,
      startingCash,
      alertRunwayThreshold,
    },
  };
}

/**
 * Validates AI chat prompt input
 */
export function validateChatInput(rawMessage: unknown): ValidationResult<string> {
  if (typeof rawMessage !== 'string') {
    return {
      isValid: false,
      errors: [{ field: 'message', message: 'Chat message must be a string' }],
    };
  }

  const trimmed = rawMessage.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      errors: [{ field: 'message', message: 'Prompt message cannot be empty' }],
    };
  }

  if (trimmed.length > 4000) {
    return {
      isValid: false,
      errors: [{ field: 'message', message: 'Prompt exceeds maximum character length (4,000 characters)' }],
    };
  }

  return {
    isValid: true,
    data: trimmed,
  };
}

/**
 * Validates sanity of derived financial metrics
 */
export function validateFinancialMetrics(metrics: {
  cashOnHand: number;
  monthlyBurn: number;
  runwayMonths: number;
}): boolean {
  return (
    isFinite(metrics.cashOnHand) &&
    metrics.cashOnHand >= 0 &&
    isFinite(metrics.monthlyBurn) &&
    metrics.monthlyBurn >= 0 &&
    isFinite(metrics.runwayMonths) &&
    metrics.runwayMonths >= 0
  );
}
