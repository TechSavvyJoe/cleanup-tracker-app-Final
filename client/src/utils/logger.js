/**
 * Professional error logging and performance monitoring utility
 */
export const Logger = {
  error: (message, error, context = {}) => {
    console.error(`[CleanupTracker Error] ${message}:`, {
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      context
    });

    // In production, you would send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: context });
    }
  },

  warn: (message, context = {}) => {
    console.warn(`[CleanupTracker Warning] ${message}:`, {
      timestamp: new Date().toISOString(),
      context
    });
  },

  info: (message, context = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[CleanupTracker Info] ${message}:`, {
        timestamp: new Date().toISOString(),
        context
      });
    }
  },

  perf: (label, fn) => {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      if (duration > 100) { // Log slow operations
        Logger.warn(`Slow operation: ${label}`, { duration: `${duration.toFixed(2)}ms` });
      }
      return result;
    } catch (error) {
      Logger.error(`Performance tracking failed for ${label}`, error);
      throw error;
    }
  }
};
