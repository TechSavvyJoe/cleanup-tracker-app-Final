import { useState, useEffect, useCallback } from 'react';
import { V2 } from '../utils/v2Client';

// Security utility for input sanitization
const Security = {
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>]/g, '') // Basic XSS prevention
      .trim()
      .slice(0, 1000); // Prevent extremely long inputs
  }
};

// Logger utility for consistent logging
const Logger = {
  error: (message, error, context = {}) => {
    console.error(`[useUsers Error] ${message}:`, {
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      context
    });
  },
  warn: (message, context = {}) => {
    console.warn(`[useUsers Warning] ${message}:`, {
      timestamp: new Date().toISOString(),
      context
    });
  },
  info: (message, context = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[useUsers Info] ${message}:`, {
        timestamp: new Date().toISOString(),
        context
      });
    }
  }
};

/**
 * Custom hook for managing users data
 * Provides user fetching with retry logic, error handling, and sanitization
 *
 * @param {Object} currentUser - Authenticated user object
 * @param {boolean} autoFetch - Whether to automatically fetch on mount (default: true)
 * @param {number} refreshInterval - Auto-refresh interval in ms (default: 0 = disabled)
 * @returns {Object} { users, usersArray, loading, error, refetch }
 */
export function useUsers(currentUser, { autoFetch = true, refreshInterval = 0 } = {}) {
  const [users, setUsers] = useState({}); // Object keyed by user ID
  const [usersArray, setUsersArray] = useState([]); // Array format
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  // Fetch users with retry logic
  const fetchUsers = useCallback(async () => {
    if (!currentUser || !currentUser.id) {
      Logger.warn('Fetch users called without authenticated user - aborting');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      Logger.info('Fetching users', { userId: currentUser.id });

      const startTime = performance.now();

      // Enhanced error handling with retries for network failures
      const fetchWithRetry = async (retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            return await V2.get('/users');
          } catch (error) {
            if (i === retries) throw error;
            Logger.warn(`Retry ${i + 1} for /users`, { error: error.message });
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          }
        }
      };

      const response = await fetchWithRetry();
      const usersData = Array.isArray(response.data) ? response.data : [];

      // Enhanced user data processing with validation and sanitization
      const usersObj = {};
      usersData.forEach(user => {
        if (user && user.id) {
          // Sanitize user data
          usersObj[user.id] = {
            ...user,
            name: Security.sanitizeInput(user.name || 'Unknown'),
            role: user.role || 'detailer'
          };
        }
      });

      setUsers(usersObj);
      setUsersArray(usersData);
      setError(null);

      const loadTime = performance.now() - startTime;
      Logger.info('Users fetched successfully', {
        loadTime: `${loadTime.toFixed(2)}ms`,
        userCount: usersData.length
      });

      if (loadTime > 2000) {
        Logger.warn('Slow users loading detected', { loadTime: `${loadTime.toFixed(2)}ms` });
      }
    } catch (err) {
      Logger.error('Failed to fetch users', err, { userId: currentUser?.id });
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load users';
      setError(errorMessage);
      setUsers({});
      setUsersArray([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && currentUser && currentUser.id) {
      // Small delay to ensure authentication state is stable
      const timer = setTimeout(() => {
        Logger.info('Starting initial users fetch', { userId: currentUser.id });
        fetchUsers();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [autoFetch, currentUser, fetchUsers]);

  // Auto-refresh interval if enabled
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0 || !currentUser || !currentUser.id) {
      return;
    }

    const interval = setInterval(() => {
      if (!loading) {
        fetchUsers();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, currentUser, loading, fetchUsers]);

  return {
    users,
    usersArray,
    loading,
    error,
    refetch: fetchUsers
  };
}
