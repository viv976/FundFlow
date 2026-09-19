import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  isValidISODate,
  sanitizeCurrency,
  validateTransactionInput,
  validateWorkspaceInput,
  validateChatInput,
  validateFinancialMetrics,
} from '@/lib/validation';

describe('Validation Boundaries', () => {
  describe('isValidUUID', () => {
    it('accepts valid UUID v4 strings', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11')).toBe(true);
    });

    it('rejects invalid UUID strings', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
    });
  });

  describe('isValidISODate', () => {
    it('validates standard YYYY-MM-DD format', () => {
      expect(isValidISODate('2025-01-15')).toBe(true);
      expect(isValidISODate('2025-13-45')).toBe(false);
      expect(isValidISODate('invalid-date')).toBe(false);
    });
  });

  describe('sanitizeCurrency', () => {
    it('sanitizes currency strings to valid 3-letter codes', () => {
      expect(sanitizeCurrency('USD')).toBe('USD');
      expect(sanitizeCurrency('eur')).toBe('EUR');
      expect(sanitizeCurrency('GBP (British Pound)')).toBe('GBP');
      expect(sanitizeCurrency(null)).toBe('USD');
      expect(sanitizeCurrency('')).toBe('USD');
    });
  });

  describe('validateTransactionInput', () => {
    it('validates a correct transaction payload', () => {
      const valid = validateTransactionInput({
        transaction_date: '2025-01-10',
        description: 'Office Supplies',
        amount: 250,
        transaction_type: 'expense',
        category: 'Office',
      });
      expect(valid.isValid).toBe(true);
      if (valid.isValid) {
        expect(valid.data.amount).toBe(250);
        expect(valid.data.transaction_type).toBe('expense');
      }
    });

    it('rejects missing or negative amounts', () => {
      const invalid = validateTransactionInput({
        transaction_date: '2025-01-10',
        description: 'Office Supplies',
        amount: -50,
        transaction_type: 'expense',
      });
      expect(invalid.isValid).toBe(false);
      if (!invalid.isValid) {
        expect(invalid.errors.some((e) => e.field === 'amount')).toBe(true);
      }
    });

    it('rejects invalid transaction types', () => {
      const invalid = validateTransactionInput({
        transaction_date: '2025-01-10',
        description: 'Office Supplies',
        amount: 50,
        transaction_type: 'transfer',
      });
      expect(invalid.isValid).toBe(false);
      if (!invalid.isValid) {
        expect(invalid.errors.some((e) => e.field === 'transaction_type')).toBe(true);
      }
    });

    it('preserves authoritative statuses: completed, pending, failed, reconciled', () => {
      const statuses = ['completed', 'pending', 'failed', 'reconciled'] as const;
      for (const st of statuses) {
        const result = validateTransactionInput({
          transaction_date: '2025-01-10',
          description: `Test ${st}`,
          amount: 100,
          transaction_type: 'expense',
          status: st,
        });
        expect(result.isValid).toBe(true);
        if (result.isValid) {
          expect(result.data.status).toBe(st);
        }
      }
    });

    it('defaults omitted status to completed', () => {
      const result = validateTransactionInput({
        transaction_date: '2025-01-10',
        description: 'No status provided',
        amount: 100,
        transaction_type: 'expense',
      });
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.data.status).toBe('completed');
      }
    });

    it('rejects invalid transaction statuses such as cancelled', () => {
      const invalid = validateTransactionInput({
        transaction_date: '2025-01-10',
        description: 'Cancelled charge',
        amount: 100,
        transaction_type: 'expense',
        status: 'cancelled',
      });
      expect(invalid.isValid).toBe(false);
      if (!invalid.isValid) {
        expect(invalid.errors.some((e) => e.field === 'status')).toBe(true);
      }
    });
  });

  describe('validateWorkspaceInput', () => {
    it('accepts valid workspace name', () => {
      const valid = validateWorkspaceInput({ name: 'Acme Corp' });
      expect(valid.isValid).toBe(true);
      if (valid.isValid) {
        expect(valid.data.name).toBe('Acme Corp');
      }
    });

    it('rejects empty or whitespace-only name', () => {
      const invalid = validateWorkspaceInput({ name: '   ' });
      expect(invalid.isValid).toBe(false);
      if (!invalid.isValid) {
        expect(invalid.errors.some((e) => e.field === 'name')).toBe(true);
      }
    });
  });

  describe('validateChatInput', () => {
    it('accepts valid prompt', () => {
      const valid = validateChatInput('What is my runway?');
      expect(valid.isValid).toBe(true);
      if (valid.isValid) {
        expect(valid.data).toBe('What is my runway?');
      }
    });

    it('rejects empty prompt', () => {
      const invalid = validateChatInput('  ');
      expect(invalid.isValid).toBe(false);
      if (!invalid.isValid) {
        expect(invalid.errors.some((e) => e.field === 'message')).toBe(true);
      }
    });

    it('rejects prompt exceeding character limit', () => {
      const longPrompt = 'a'.repeat(4001);
      const invalid = validateChatInput(longPrompt);
      expect(invalid.isValid).toBe(false);
      if (!invalid.isValid) {
        expect(invalid.errors.some((e) => e.field === 'message')).toBe(true);
      }
    });
  });

  describe('validateFinancialMetrics', () => {
    it('accepts valid financial metrics', () => {
      const valid = validateFinancialMetrics({
        cashOnHand: 1000000,
        monthlyBurn: 50000,
        runwayMonths: 20,
      });
      expect(valid).toBe(true);
    });

    it('rejects negative or NaN metrics', () => {
      const invalid = validateFinancialMetrics({
        cashOnHand: -100,
        monthlyBurn: 50000,
        runwayMonths: 20,
      });
      expect(invalid).toBe(false);
    });
  });
});
