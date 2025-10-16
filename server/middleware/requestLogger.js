/**
 * HTTP Request Logging Middleware
 *
 * Features:
 * - Logs all HTTP requests
 * - Records response time
 * - Logs status codes
 * - Tracks user agents and IPs
 * - Performance monitoring
 *
 * Usage: Add early in middleware chain
 * app.use(requestLogger);
 */

const logger = require('../utils/logger');

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function to log after response
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    // Determine log level based on status code
    let logLevel = 'info';
    if (statusCode >= 500) logLevel = 'error';
    else if (statusCode >= 400) logLevel = 'warn';
    else if (statusCode >= 300) logLevel = 'info';

    // Log request
    logger[logLevel]('HTTP Request', {
      method,
      url: originalUrl,
      statusCode,
      duration: `${duration}ms`,
      ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id || 'anonymous',
      contentLength: res.get('content-length') || '0'
    });

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Performance monitoring middleware
 * Logs slow requests (configurable threshold)
 */
function performanceMonitor(threshold = 1000) {
  return (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (duration > threshold) {
        logger.warn('Slow Request', {
          method: req.method,
          url: req.originalUrl,
          duration: `${duration}ms`,
          threshold: `${threshold}ms`,
          userId: req.user?.id || 'anonymous'
        });
      }
    });

    next();
  };
}

module.exports = {
  requestLogger,
  performanceMonitor
};
