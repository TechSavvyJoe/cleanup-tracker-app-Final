/**
 * Custom Error Classes for Better Error Handling
 *
 * Features:
 * - Structured error responses
 * - HTTP status codes
 * - Error categorization
 * - Stack trace in development
 *
 * Usage:
 * throw new BadRequestError('Invalid email format');
 * throw new NotFoundError('User not found');
 * throw new UnauthorizedError('Invalid credentials');
 */

/**
 * Base Application Error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV !== 'production' && { stack: this.stack })
    };
  }
}

/**
 * 400 Bad Request - Client sent invalid data
 */
class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400);
    this.name = 'BadRequestError';
    this.details = details;
  }

  toJSON() {
    const json = super.toJSON();
    if (this.details) {
      json.details = this.details;
    }
    return json;
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden - User doesn't have permission
 */
class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 Conflict - Resource already exists or conflict with current state
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * 422 Unprocessable Entity - Validation failed
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 422);
    this.name = 'ValidationError';
    this.errors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors
    };
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = null) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }

  toJSON() {
    const json = super.toJSON();
    if (this.retryAfter) {
      json.retryAfter = this.retryAfter;
    }
    return json;
  }
}

/**
 * 500 Internal Server Error - Something went wrong on the server
 */
class InternalServerError extends AppError {
  constructor(message = 'Internal server error', originalError = null) {
    super(message, 500, false); // Not operational
    this.name = 'InternalServerError';
    this.originalError = originalError;
  }

  toJSON() {
    const json = super.toJSON();
    if (process.env.NODE_ENV !== 'production' && this.originalError) {
      json.originalError = {
        message: this.originalError.message,
        stack: this.originalError.stack
      };
    }
    return json;
  }
}

/**
 * 503 Service Unavailable - External service or database unavailable
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', retryAfter = null) {
    super(message, 503);
    this.name = 'ServiceUnavailableError';
    this.retryAfter = retryAfter;
  }

  toJSON() {
    const json = super.toJSON();
    if (this.retryAfter) {
      json.retryAfter = this.retryAfter;
    }
    return json;
  }
}

/**
 * Database Error - Database operation failed
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', operation = null) {
    super(message, 500, false);
    this.name = 'DatabaseError';
    this.operation = operation;
  }

  toJSON() {
    const json = super.toJSON();
    if (this.operation && process.env.NODE_ENV !== 'production') {
      json.operation = this.operation;
    }
    return json;
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError
};
