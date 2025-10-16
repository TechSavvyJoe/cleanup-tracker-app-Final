/**
 * Professional Logging System using Winston
 *
 * Features:
 * - Structured logging with different levels
 * - Daily log rotation
 * - Separate error logs
 * - Console output in development
 * - JSON format for production
 * - Performance-optimized
 *
 * Usage:
 * const logger = require('./utils/logger');
 * logger.info('Server started', { port: 5051 });
 * logger.error('Database connection failed', { error: err.message });
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Define log transports
const transports = [];

// Console transport (development only, or if LOG_TO_CONSOLE=true)
if (isDevelopment || process.env.LOG_TO_CONSOLE === 'true') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'debug'
    })
  );
}

// Daily rotating file transport for all logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // Keep logs for 14 days
    format: logFormat,
    level: isProduction ? 'info' : 'debug'
  })
);

// Separate file for errors
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d', // Keep error logs for 30 days
    format: logFormat,
    level: 'error'
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: logFormat,
  transports,
  exitOnError: false,
  // Don't log unhandled exceptions in production (let process managers handle it)
  exceptionHandlers: isDevelopment ? [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ] : undefined
});

// Add utility methods for common logging patterns

/**
 * Log HTTP request
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {number} duration - Request duration in ms
 */
logger.http = function(req, res, duration) {
  const { method, originalUrl, ip } = req;
  const { statusCode } = res;

  this.info('HTTP Request', {
    method,
    url: originalUrl,
    statusCode,
    duration: `${duration}ms`,
    ip,
    userAgent: req.get('user-agent')
  });
};

/**
 * Log database query
 * @param {string} operation - Query operation (find, update, etc)
 * @param {string} collection - Collection name
 * @param {number} duration - Query duration in ms
 */
logger.db = function(operation, collection, duration) {
  this.debug('Database Query', {
    operation,
    collection,
    duration: `${duration}ms`
  });
};

/**
 * Log authentication events
 * @param {string} event - Auth event type (login, logout, etc)
 * @param {string} userId - User ID
 * @param {boolean} success - Whether the operation succeeded
 */
logger.auth = function(event, userId, success) {
  this.info('Authentication Event', {
    event,
    userId,
    success
  });
};

/**
 * Log security events
 * @param {string} event - Security event type
 * @param {object} details - Event details
 */
logger.security = function(event, details) {
  this.warn('Security Event', {
    event,
    ...details
  });
};

/**
 * Log startup information
 * @param {string} message - Startup message
 * @param {object} details - Configuration details
 */
logger.startup = function(message, details = {}) {
  this.info(`🚀 ${message}`, details);
};

// Add stream for Morgan HTTP logger
logger.stream = {
  write: function(message) {
    logger.info(message.trim());
  }
};

module.exports = logger;
