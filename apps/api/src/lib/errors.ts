/**
 * Typed error hierarchy used across the API.
 *
 * Every error carries an HTTP status, a stable machine-readable code,
 * and an optional `details` payload. The error middleware converts
 * thrown ApiError instances into safe JSON responses with no stack
 * leakage in production.
 */

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'NOT_IMPLEMENTED'
  | 'MFA_REQUIRED'
  | 'ACCOUNT_LOCKED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TENANT_MISMATCH'
  | 'INSUFFICIENT_PERMISSIONS';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly details: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Unauthorized', details?: unknown): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message, details);
  }
  static forbidden(message = 'Forbidden', details?: unknown): ApiError {
    return new ApiError(403, 'FORBIDDEN', message, details);
  }
  static notFound(message = 'Not found', details?: unknown): ApiError {
    return new ApiError(404, 'NOT_FOUND', message, details);
  }
  static conflict(message = 'Conflict', details?: unknown): ApiError {
    return new ApiError(409, 'CONFLICT', message, details);
  }
  static unprocessable(message = 'Unprocessable entity', details?: unknown): ApiError {
    return new ApiError(422, 'UNPROCESSABLE', message, details);
  }
  static rateLimited(message = 'Too many requests', details?: unknown): ApiError {
    return new ApiError(429, 'RATE_LIMITED', message, details);
  }
  static internal(message = 'Internal server error', details?: unknown): ApiError {
    return new ApiError(500, 'INTERNAL', message, details);
  }
  static notImplemented(message = 'Not implemented', details?: unknown): ApiError {
    return new ApiError(501, 'NOT_IMPLEMENTED', message, details);
  }
  static mfaRequired(message = 'Multi-factor authentication required'): ApiError {
    return new ApiError(401, 'MFA_REQUIRED', message);
  }
  static accountLocked(message = 'Account temporarily locked due to failed login attempts'): ApiError {
    return new ApiError(423, 'ACCOUNT_LOCKED', message);
  }
  static invalidCredentials(message = 'Invalid email or password'): ApiError {
    return new ApiError(401, 'INVALID_CREDENTIALS', message);
  }
  static tokenExpired(message = 'Token expired'): ApiError {
    return new ApiError(401, 'TOKEN_EXPIRED', message);
  }
  static tokenInvalid(message = 'Token invalid'): ApiError {
    return new ApiError(401, 'TOKEN_INVALID', message);
  }
  static tenantMismatch(message = 'Resource does not belong to your organization'): ApiError {
    return new ApiError(403, 'TENANT_MISMATCH', message);
  }
  static insufficientPermissions(message = 'Insufficient permissions'): ApiError {
    return new ApiError(403, 'INSUFFICIENT_PERMISSIONS', message);
  }
}
