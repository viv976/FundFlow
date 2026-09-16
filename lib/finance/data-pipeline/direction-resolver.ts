import { TransactionType } from '@/types/finance';

export interface DirectionResolutionSuccess {
  isValid: true;
  amount: number; // strictly positive finite float
  transactionType: TransactionType;
  error?: never;
}

export interface DirectionResolutionFailure {
  isValid: false;
  amount?: number;
  transactionType?: never;
  error: {
    code: 'DIRECTION_CONFLICT' | 'UNKNOWN_DIRECTION' | 'MALFORMED_AMOUNT';
    message: string;
  };
}

export type DirectionResolutionResult =
  | DirectionResolutionSuccess
  | DirectionResolutionFailure;

export interface RawDirectionInputs {
  rawAmount?: string | number | null;
  rawDebit?: string | number | null;
  rawCredit?: string | number | null;
  rawType?: string | null;
}

/**
 * Parses numeric currency/accounting string: handles currency symbols, commas, parentheses.
 */
export function parseRawNumeric(val: string | number | undefined | null): {
  isValid: boolean;
  value: number;
  isNegative: boolean;
  isParentheses: boolean;
} {
  if (val === undefined || val === null) {
    return { isValid: false, value: 0, isNegative: false, isParentheses: false };
  }

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) {
      return { isValid: false, value: 0, isNegative: false, isParentheses: false };
    }
    return {
      isValid: true,
      value: Math.abs(val),
      isNegative: val < 0,
      isParentheses: false,
    };
  }

  let str = String(val).trim();
  if (!str) {
    return { isValid: false, value: 0, isNegative: false, isParentheses: false };
  }

  // Detect accounting parentheses: (1,245.00)
  const isParentheses = /^\(.*\)$/.test(str);
  if (isParentheses) {
    str = str.replace(/^\((.*)\)$/, '$1');
  }

  // Remove currency signs, commas, extra whitespace
  const cleaned = str.replace(/[$€£₹CA$AU$SG$¥,\s]/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed) || !isFinite(parsed)) {
    return { isValid: false, value: 0, isNegative: false, isParentheses: false };
  }

  const isNegative = isParentheses || parsed < 0 || str.startsWith('-');
  return {
    isValid: true,
    value: Math.abs(parsed),
    isNegative,
    isParentheses,
  };
}

/**
 * Normalizes explicit type strings (e.g. "income", "credit", "cr", "deposit", "in" vs "expense", "debit", "dr", "withdrawal", "out")
 */
export function parseExplicitType(rawType?: string | null): TransactionType | null {
  if (!rawType || typeof rawType !== 'string') return null;
  const t = rawType.trim().toLowerCase();
  if (!t) return null;

  if (
    t === 'income' ||
    t === 'revenue' ||
    t === 'credit' ||
    t === 'cr' ||
    t === 'deposit' ||
    t === 'inflow' ||
    t === 'in'
  ) {
    return 'income';
  }

  if (
    t === 'expense' ||
    t === 'debit' ||
    t === 'dr' ||
    t === 'withdrawal' ||
    t === 'outflow' ||
    t === 'out' ||
    t === 'spend'
  ) {
    return 'expense';
  }

  return null;
}

/**
 * Deterministic Direction Precedence:
 * 1. If both debit and credit contain numeric positive values: -> DIRECTION_CONFLICT error.
 * 2. If debit/credit provides an unambiguous direction:
 *    -> debit = expense
 *    -> credit = income
 *    Checked against explicit type (debit + income -> conflict; credit + expense -> conflict).
 * 3. If an explicit transaction type is present and valid:
 *    -> use the explicit type when it does not conflict with debit/credit.
 *    (A raw positive amount alone does NOT imply income when an explicit type exists).
 * 4. If neither debit/credit nor explicit type provides direction:
 *    -> derive direction from the signed amount (negative/parentheses = expense, positive = income).
 * 5. If no reliable direction signal exists:
 *    -> UNKNOWN_DIRECTION error.
 */
export function resolveTransactionDirection(inputs: RawDirectionInputs): DirectionResolutionResult {
  const { rawAmount, rawDebit, rawCredit, rawType } = inputs;

  const debitNum = parseRawNumeric(rawDebit);
  const creditNum = parseRawNumeric(rawCredit);
  const amountNum = parseRawNumeric(rawAmount);
  const explicitType = parseExplicitType(rawType);

  const hasPositiveDebit = debitNum.isValid && debitNum.value > 0;
  const hasPositiveCredit = creditNum.isValid && creditNum.value > 0;

  // RULE 1: Both debit and credit contain numeric positive values (> 0)
  if (hasPositiveDebit && hasPositiveCredit) {
    return {
      isValid: false,
      error: {
        code: 'DIRECTION_CONFLICT',
        message: 'Row contains conflicting positive values in both Debit and Credit columns.',
      },
    };
  }

  // RULE 2: Debit/Credit provides an unambiguous direction
  if (hasPositiveDebit) {
    // Debit indicates expense
    if (explicitType && explicitType === 'income') {
      return {
        isValid: false,
        error: {
          code: 'DIRECTION_CONFLICT',
          message: 'Conflicting direction: Debit column indicates expense but Transaction Type indicates income.',
        },
      };
    }
    return {
      isValid: true,
      amount: debitNum.value,
      transactionType: 'expense',
    };
  }

  if (hasPositiveCredit) {
    // Credit indicates income
    if (explicitType && explicitType === 'expense') {
      return {
        isValid: false,
        error: {
          code: 'DIRECTION_CONFLICT',
          message: 'Conflicting direction: Credit column indicates income but Transaction Type indicates expense.',
        },
      };
    }
    return {
      isValid: true,
      amount: creditNum.value,
      transactionType: 'income',
    };
  }

  // RULE 3: Explicit transaction type is present and valid
  // Uses explicit type when it does not conflict with debit/credit.
  // Both positive and negative amounts with explicit type are valid.
  if (explicitType) {
    // We need a valid positive amount
    const effectiveAmount = amountNum.isValid && amountNum.value > 0
      ? amountNum.value
      : (debitNum.isValid && debitNum.value > 0 ? debitNum.value : (creditNum.isValid && creditNum.value > 0 ? creditNum.value : 0));

    if (effectiveAmount <= 0) {
      return {
        isValid: false,
        error: {
          code: 'MALFORMED_AMOUNT',
          message: 'Transaction amount must be a positive finite number greater than zero.',
        },
      };
    }

    return {
      isValid: true,
      amount: effectiveAmount,
      transactionType: explicitType,
    };
  }

  // RULE 4: Neither debit/credit nor explicit type provides direction -> derive from signed amount
  if (amountNum.isValid && amountNum.value > 0) {
    const derivedType: TransactionType = amountNum.isNegative ? 'expense' : 'income';
    return {
      isValid: true,
      amount: amountNum.value,
      transactionType: derivedType,
    };
  }

  // If amount was parsed as 0
  if (amountNum.isValid && amountNum.value === 0) {
    return {
      isValid: false,
      error: {
        code: 'MALFORMED_AMOUNT',
        message: 'Transaction amount cannot be zero.',
      },
    };
  }

  // RULE 5: No reliable direction signal exists
  return {
    isValid: false,
    error: {
      code: 'UNKNOWN_DIRECTION',
      message: 'No reliable direction signal exists. Map an amount, debit/credit, or transaction type column.',
    },
  };
}
