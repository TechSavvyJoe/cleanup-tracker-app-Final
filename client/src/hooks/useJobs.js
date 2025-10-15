import { useState, useEffect, useCallback } from 'react';
import { V2 } from '../utils/v2Client';

// Logger utility for consistent logging
const Logger = {
  error: (message, error, context = {}) => {
    console.error(`[useJobs Error] ${message}:`, {
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      context
    });
  },
  warn: (message, context = {}) => {
    console.warn(`[useJobs Warning] ${message}:`, {
      timestamp: new Date().toISOString(),
      context
    });
  },
  info: (message, context = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[useJobs Info] ${message}:`, {
        timestamp: new Date().toISOString(),
        context
      });
    }
  }
};

/**
 * Custom hook for managing jobs data
 * Provides job fetching with retry logic and error handling
 *
 * @param {Object} user - Authenticated user object
 * @param {boolean} autoFetch - Whether to automatically fetch on mount (default: true)
 * @param {number} refreshInterval - Auto-refresh interval in ms (default: 30000 = 30s, 0 to disable)
 * @returns {Object} { jobs, loading, error, refetch }
 */
export function useJobs(user, { autoFetch = true, refreshInterval = 30000 } = {}) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  // Fetch jobs with retry logic
  const fetchJobs = useCallback(async () => {
    if (!user || !user.id) {
      Logger.warn('Fetch jobs called without authenticated user - aborting');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      Logger.info('Fetching jobs', { userId: user.id });

      const startTime = performance.now();

      // Enhanced error handling with retries for network failures
      const fetchWithRetry = async (retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            return await V2.get('/jobs');
          } catch (error) {
            if (i === retries) throw error;
            Logger.warn(`Retry ${i + 1} for /jobs`, { error: error.message });
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          }
        }
      };

      const response = await fetchWithRetry();
      const jobsData = Array.isArray(response.data) ? response.data : [];

      setJobs(jobsData);
      setError(null);

      const loadTime = performance.now() - startTime;
      Logger.info('Jobs fetched successfully', {
        loadTime: `${loadTime.toFixed(2)}ms`,
        jobCount: jobsData.length
      });

      if (loadTime > 2000) {
        Logger.warn('Slow jobs loading detected', { loadTime: `${loadTime.toFixed(2)}ms` });
      }
    } catch (err) {
      Logger.error('Failed to fetch jobs', err, { userId: user?.id });
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load jobs';
      setError(errorMessage);
      setJobs([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && user && user.id) {
      // Small delay to ensure authentication state is stable
      const timer = setTimeout(() => {
        Logger.info('Starting initial jobs fetch', { userId: user.id });
        fetchJobs();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [autoFetch, user, fetchJobs]);

  // Auto-refresh interval if enabled
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0 || !user || !user.id) {
      return;
    }

    const interval = setInterval(() => {
      if (!loading) {
        fetchJobs();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, user, loading, fetchJobs]);

  return {
    jobs,
    loading,
    error,
    refetch: fetchJobs
  };
}
