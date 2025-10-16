/**
 * Global Error Handling Middleware
 *
 * Features:
 * - Catches all errors from routes
 * - Formats error responses consistently
 * - Logs errors with Winston
 * - Handles different error types
 * - Provides stack traces in development
 *
 * Usage: Add as the last middleware in server.js
 * app.use(errorHandler);
 */

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Handle Mongoose validation errors
 */
function handleMongooseValidationError(err) {
  const errors = Object.values(err.errors).map(e => ({
    field: e.path,
    message: e.message,
    value: e.value
  }));

  return {
    statusCode: 422,
    message: 'Validation failed',
    errors
  };
}

/**
 * Handle Mongoose duplicate key errors
 */
function handleMongoDuplicateKeyError(err) {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];

  return {
    statusCode: 409,
    message: `${field} '${value}' already exists`,
    field
  };
}

/**
 * Handle Mongoose cast errors (invalid ObjectId, etc.)
 */
function handleMongoCastError(err) {
  return {
    statusCode: 400,
    message: `Invalid ${err.path}: ${err.value}`
  };
}

/**
 * Handle JWT errors
 */
function handleJWTError(err) {
  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      message: 'Invalid token'
    };
  }
  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      message: 'Token expired'
    };
  }
  return null;
}

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Default to 500 if no status code
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || null;
  let details = null;

  // Handle specific error types
  if (err.name === 'ValidationError' && err.errors) {
    const handled = handleMongooseValidationError(err);
    statusCode = handled.statusCode;
    message = handled.message;
    errors = handled.errors;
  } else if (err.code === 11000) {
    const handled = handleMongoDuplicateKeyError(err);
    statusCode = handled.statusCode;
    message = handled.message;
    details = { field: handled.field };
  } else if (err.name === 'CastError') {
    const handled = handleMongoCastError(err);
    statusCode = handled.statusCode;
    message = handled.message;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const handled = handleJWTError(err);
    if (handled) {
      statusCode = handled.statusCode;
      message = handled.message;
    }
  }

  // Log error
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]('Request Error', {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    ...(statusCode >= 500 && { stack: err.stack })
  });

  // Build response
  const response = {
    error: message,
    statusCode
  };

  // Add additional info
  if (errors) response.errors = errors;
  if (details) response.details = details;

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
    if (err.originalError) {
      response.originalError = {
        message: err.originalError.message,
        stack: err.originalError.stack
      };
    }
  }

  // Send response
  res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler
 * Place this before the global error handler
 */
function notFoundHandler(req, res, next) {
  const error = {
    statusCode: 404,
    message: `Route ${req.method} ${req.originalUrl} not found`
  };

  logger.warn('Route Not Found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json(error);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 *
 * Usage:
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.find();
 *   res.json(users);
 * }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
