/**
 * FundFlow Foundation Error System
 * Provides typed, user-safe error representations and security-conscious diagnostic logging.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'DATABASE_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {
  public field?: string;

  constructor(message: string, fieldOrDetails?: string | Record<string, unknown>) {
    const details = typeof fieldOrDetails === 'string' ? { field: fieldOrDetails } : fieldOrDetails;
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
    if (typeof fieldOrDetails === 'string') {
      this.field = fieldOrDetails;
    } else if (fieldOrDetails && typeof fieldOrDetails.field === 'string') {
      this.field = fieldOrDetails.field;
    }
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Unauthorized: Access is denied', isForbidden: boolean = false) {
    super(message, isForbidden ? 'FORBIDDEN' : 'UNAUTHORIZED', isForbidden ? 403 : 401);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resourceName: string, identifier?: string) {
    super(
      `${resourceName}${identifier ? ` with ID "${identifier}"` : ''} was not found`,
      'NOT_FOUND',
      404
    );
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

export function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const sanitized: Record<string, unknown> = {};

  const sensitivePattern = /token|secret|key|password|authorization|credential/i;

  for (const [k, v] of Object.entries(context)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeContext(v as Record<string, unknown>);
    } else if (sensitivePattern.test(k)) {
      sanitized[k] = '[REDACTED]';
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

/**
 * Returns a user-safe message that never leaks database internals or secrets
 */
export function getUserSafeErrorMessage(error: unknown, fallback: string = 'An unexpected error occurred'): string {
  if (error instanceof AppError && error.isOperational) {
    return error.message;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Avoid leaking raw postgres, internal database constraints or network stack details
    if (
      msg.includes('connection') ||
      msg.includes('relation') ||
      msg.includes('syntax') ||
      msg.includes('postgrest') ||
      msg.includes('supabase') ||
      msg.includes('econnrefused') ||
      msg.includes('duplicate key') ||
      msg.includes('constraint') ||
      msg.includes('failed to fetch')
    ) {
      return 'A database operation failed. Please verify your connection or try again later.';
    }
    return error.message;
  }
  return fallback;
}
