import { DateFormatPreference } from './types';

export interface DateParseResult {
  isValid: boolean;
  isAmbiguous: boolean;
  isoDate?: string; // YYYY-MM-DD
  errorReason?: string;
}

/**
 * Checks if a date represents a real calendar date (validates days in February, 30 vs 31 days, leap years)
 */
function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1970 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Days in month check
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Comprehensive date parser with ambiguity detection.
 * When formatPreference is 'AUTO' and date has form XX/YY/ZZZZ where both XX and YY <= 12 and XX !== YY,
 * the date is surfaced as ambiguous rather than silently guessing.
 */
export function parseDateWithAmbiguity(
  rawVal: unknown,
  formatPreference: DateFormatPreference = 'AUTO'
): DateParseResult {
  if (rawVal === undefined || rawVal === null) {
    return { isValid: false, isAmbiguous: false, errorReason: 'Date is missing or empty' };
  }

  const str = String(rawVal).trim();
  if (!str) {
    return { isValid: false, isAmbiguous: false, errorReason: 'Date is missing or empty' };
  }

  // 1. Strict ISO YYYY-MM-DD Check
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    if (isValidCalendarDate(y, m, d)) {
      return { isValid: true, isAmbiguous: false, isoDate: str };
    }
    return { isValid: false, isAmbiguous: false, errorReason: `Invalid calendar date: ${str}` };
  }

  // 2. Tokenize separated by slashes, dots, or dashes
  const parts = str.split(/[\/\-\.]/).map((p) => p.trim());
  if (parts.length === 3) {
    const [p0, p1, p2] = parts;

    // Case A: YYYY/MM/DD
    if (p0.length === 4) {
      const year = parseInt(p0, 10);
      const month = parseInt(p1, 10);
      const day = parseInt(p2, 10);
      if (isValidCalendarDate(year, month, day)) {
        return {
          isValid: true,
          isAmbiguous: false,
          isoDate: `${year}-${pad(month)}-${pad(day)}`,
        };
      }
      return { isValid: false, isAmbiguous: false, errorReason: `Invalid calendar date: ${str}` };
    }

    // Case B: XX/YY/YYYY or XX/YY/YY
    let year = parseInt(p2, 10);
    if (p2.length === 2) {
      year = year > 50 ? 1900 + year : 2000 + year;
    }

    const n0 = parseInt(p0, 10);
    const n1 = parseInt(p1, 10);

    if (isNaN(n0) || isNaN(n1) || isNaN(year)) {
      return { isValid: false, isAmbiguous: false, errorReason: `Malformed date format: ${str}` };
    }

    // Explicit format preferences
    if (formatPreference === 'DD/MM/YYYY') {
      const day = n0;
      const month = n1;
      if (isValidCalendarDate(year, month, day)) {
        return {
          isValid: true,
          isAmbiguous: false,
          isoDate: `${year}-${pad(month)}-${pad(day)}`,
        };
      }
      return { isValid: false, isAmbiguous: false, errorReason: `Invalid DD/MM/YYYY date: ${str}` };
    }

    if (formatPreference === 'MM/DD/YYYY') {
      const month = n0;
      const day = n1;
      if (isValidCalendarDate(year, month, day)) {
        return {
          isValid: true,
          isAmbiguous: false,
          isoDate: `${year}-${pad(month)}-${pad(day)}`,
        };
      }
      return { isValid: false, isAmbiguous: false, errorReason: `Invalid MM/DD/YYYY date: ${str}` };
    }

    if (formatPreference === 'YYYY-MM-DD') {
      return { isValid: false, isAmbiguous: false, errorReason: `Expected YYYY-MM-DD format but received ${str}` };
    }

    // AUTO mode disambiguation
    if (formatPreference === 'AUTO') {
      // If one token is > 12, there is no ambiguity:
      if (n0 > 12 && n1 <= 12) {
        // n0 is day, n1 is month
        if (isValidCalendarDate(year, n1, n0)) {
          return {
            isValid: true,
            isAmbiguous: false,
            isoDate: `${year}-${pad(n1)}-${pad(n0)}`,
          };
        }
      } else if (n1 > 12 && n0 <= 12) {
        // n0 is month, n1 is day
        if (isValidCalendarDate(year, n0, n1)) {
          return {
            isValid: true,
            isAmbiguous: false,
            isoDate: `${year}-${pad(n0)}-${pad(n1)}`,
          };
        }
      } else if (n0 <= 12 && n1 <= 12) {
        // If n0 === n1 (e.g. 05/05/2026), it's not ambiguous!
        if (n0 === n1) {
          if (isValidCalendarDate(year, n0, n1)) {
            return {
              isValid: true,
              isAmbiguous: false,
              isoDate: `${year}-${pad(n0)}-${pad(n1)}`,
            };
          }
        } else {
          // Both <= 12 and not equal: AMBIGUOUS DATE! (e.g. 01/02/2026 could be Jan 2 or Feb 1)
          return {
            isValid: false,
            isAmbiguous: true,
            errorReason: `Ambiguous date "${str}". Day and month both <= 12. Please explicitly select DD/MM/YYYY or MM/DD/YYYY.`,
          };
        }
      }
    }
  }

  // General fallback parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    if (isValidCalendarDate(y, m, d)) {
      return {
        isValid: true,
        isAmbiguous: false,
        isoDate: `${y}-${pad(m)}-${pad(d)}`,
      };
    }
  }

  return { isValid: false, isAmbiguous: false, errorReason: `Cannot parse date: ${str}` };
}
