import { useState, useEffect, useCallback, useRef } from 'react';
import { V2 } from '../utils/v2Client';
import { ensureServiceTypeCatalog, DEFAULT_SERVICE_TYPES } from '../utils/serviceTypes';

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
    console.error(`[useSettings Error] ${message}:`, {
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      context
    });
  },
  warn: (message, context = {}) => {
    console.warn(`[useSettings Warning] ${message}:`, {
      timestamp: new Date().toISOString(),
      context
    });
  },
  info: (message, context = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[useSettings Info] ${message}:`, {
        timestamp: new Date().toISOString(),
        context
      });
    }
  }
};

/**
 * Custom hook for managing app settings
 * Provides settings fetching and updating with error handling and sanitization
 *
 * @param {Object} currentUser - Authenticated user object
 * @param {boolean} autoFetch - Whether to automatically fetch on mount (default: true)
 * @returns {Object} { settings, loading, error, updateSettings, refetch }
 */
export function useSettings(currentUser, { autoFetch = true } = {}) {
  const [settings, setSettings] = useState({
    siteTitle: 'Cleanup Tracker',
    serviceTypes: DEFAULT_SERVICE_TYPES
  });
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  // Track mount status to prevent setState on unmounted component
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch settings with retry logic
  const fetchSettings = useCallback(async () => {
    if (!currentUser || !currentUser.id) {
      Logger.warn('Fetch settings called without authenticated user - using defaults');
      setSettings({
        siteTitle: 'Cleanup Tracker',
        serviceTypes: DEFAULT_SERVICE_TYPES
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      Logger.info('Fetching settings', { userId: currentUser.id });

      const startTime = performance.now();

      // Enhanced error handling with retries for network failures
      const fetchWithRetry = async (retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          // Check if component is still mounted before continuing
          if (!isMountedRef.current) return null;

          try {
            return await V2.get('/settings');
          } catch (error) {
            if (i === retries) throw error;
            if (!isMountedRef.current) return null; // Check before delay

            Logger.warn(`Retry ${i + 1} for /settings`, { error: error.message });
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          }
        }
      };

      const response = await fetchWithRetry().catch(() => {
        if (!isMountedRef.current) return null;
        Logger.warn('Settings endpoint failed, using defaults');
        return {
          data: {
            siteTitle: 'Cleanup Tracker',
            serviceTypes: DEFAULT_SERVICE_TYPES
          }
        };
      });

      // Don't update state if component unmounted
      if (!isMountedRef.current || !response) return;

      const settingsData = response.data || {
        siteTitle: 'Cleanup Tracker',
        serviceTypes: DEFAULT_SERVICE_TYPES
      };

      // Sanitize settings
      const sanitizedSettings = {
        ...settingsData,
        siteTitle: Security.sanitizeInput(settingsData.siteTitle || 'Cleanup Tracker'),
        theme: settingsData.theme || 'dark',
        serviceTypes: ensureServiceTypeCatalog(settingsData.serviceTypes)
      };

      if (isMountedRef.current) {
        setSettings(sanitizedSettings);
        setError(null);

        const loadTime = performance.now() - startTime;
        Logger.info('Settings fetched successfully', {
          loadTime: `${loadTime.toFixed(2)}ms`,
          siteTitle: sanitizedSettings.siteTitle
        });
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      Logger.error('Failed to fetch settings', err, { userId: currentUser?.id });
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load settings';
      setError(errorMessage);
      // Keep default settings on error
      setSettings({
        siteTitle: 'Cleanup Tracker',
        serviceTypes: DEFAULT_SERVICE_TYPES
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [currentUser]);

  // Update settings
  const updateSettings = useCallback(async (key, value) => {
    if (!currentUser || !currentUser.id) {
      Logger.warn('Update settings called without authenticated user');
      throw new Error('User must be authenticated to update settings');
    }

    try {
      Logger.info('Updating settings', { key, userId: currentUser.id });

      await V2.put('/settings', { key, value });

      // Refetch settings to ensure consistency
      await fetchSettings();

      Logger.info('Settings updated successfully', { key });
      return true;
    } catch (err) {
      Logger.error('Failed to update settings', err, { key, userId: currentUser?.id });
      throw new Error(err.response?.data?.error || err.message || 'Failed to update settings');
    }
  }, [currentUser, fetchSettings]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && currentUser && currentUser.id) {
      // Small delay to ensure authentication state is stable
      const timer = setTimeout(() => {
        Logger.info('Starting initial settings fetch', { userId: currentUser.id });
        fetchSettings();
      }, 100);

      return () => clearTimeout(timer);
    } else if (autoFetch && !currentUser) {
      // Set defaults if no user
      setSettings({ siteTitle: 'Cleanup Tracker' });
      setLoading(false);
    }
  }, [autoFetch, currentUser, fetchSettings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings
  };
}
