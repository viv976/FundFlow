import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  getUserSafeErrorMessage,
  sanitizeContext,
} from '@/lib/errors';

describe('Error Handling and Sanitization', () => {
  it('creates custom typed errors with proper status codes and details', () => {
    const baseErr = new AppError('Base operational error', 'INTERNAL_ERROR', 500);
    expect(baseErr.isOperational).toBe(true);
    expect(baseErr.code).toBe('INTERNAL_ERROR');

    const valErr = new ValidationError('Invalid amount', 'amount');
    expect(valErr.statusCode).toBe(400);
    expect(valErr.name).toBe('ValidationError');
    expect(valErr.field).toBe('amount');

    const authErr = new AuthorizationError();
    expect(authErr.statusCode).toBe(401);

    const notFoundErr = new NotFoundError('Workspace');
    expect(notFoundErr.statusCode).toBe(404);
    expect(notFoundErr.message).toBe('Workspace was not found');

    const dbErr = new DatabaseError('Failed query', { table: 'transactions' });
    expect(dbErr.statusCode).toBe(500);
  });

  describe('getUserSafeErrorMessage', () => {
    it('returns custom message for AppError instances', () => {
      const err = new ValidationError('Please provide a valid date');
      expect(getUserSafeErrorMessage(err)).toBe('Please provide a valid date');
    });

    it('redacts raw database errors containing internal table or constraint details', () => {
      const rawPostgresErr = new Error('duplicate key value violates unique constraint "transactions_pkey"');
      const safeMessage = getUserSafeErrorMessage(rawPostgresErr);
      expect(safeMessage).not.toContain('transactions_pkey');
      expect(safeMessage).toBe('A database operation failed. Please verify your connection or try again later.');
    });

    it('redacts network and connection errors safely', () => {
      const connErr = new Error('ECONNREFUSED 127.0.0.1:5432');
      const safeMsg = getUserSafeErrorMessage(connErr);
      expect(safeMsg).toBe('A database operation failed. Please verify your connection or try again later.');
    });

    it('returns default fallback for non-Error unknown values', () => {
      const safeMsg = getUserSafeErrorMessage(null, 'Default fallback');
      expect(safeMsg).toBe('Default fallback');
    });
  });

  describe('sanitizeContext', () => {
    it('redacts sensitive fields like apiKey, secret, password, and token', () => {
      const sensitive = {
        userId: '123',
        apiKey: 'secret-api-key-xyz',
        supabaseKey: 'service-role-secret',
        password: 'supersecretpassword',
        token: 'bearer-token-val',
        regularField: 'safeValue',
      };

      const sanitized = sanitizeContext(sensitive);
      expect(sanitized?.userId).toBe('123');
      expect(sanitized?.regularField).toBe('safeValue');
      expect(sanitized?.apiKey).toBe('[REDACTED]');
      expect(sanitized?.supabaseKey).toBe('[REDACTED]');
      expect(sanitized?.password).toBe('[REDACTED]');
      expect(sanitized?.token).toBe('[REDACTED]');
    });

    it('handles nested objects recursively', () => {
      const nested = {
        config: {
          settings: {
            service_key: 'top-secret',
            env: 'production',
          },
        },
      };

      const sanitized = sanitizeContext(nested) as { config: { settings: { service_key: string; env: string } } };
      expect(sanitized.config.settings.service_key).toBe('[REDACTED]');
      expect(sanitized.config.settings.env).toBe('production');
    });
  });
});
