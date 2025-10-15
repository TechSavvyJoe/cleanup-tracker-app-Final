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
  const [settings, setSettings] = useState({ siteTitle: 'Cleanup Tracker' });
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  // Fetch settings with retry logic
  const fetchSettings = useCallback(async () => {
    if (!currentUser || !currentUser.id) {
      Logger.warn('Fetch settings called without authenticated user - using defaults');
      setSettings({ siteTitle: 'Cleanup Tracker' });
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
          try {
            return await V2.get('/settings');
          } catch (error) {
            if (i === retries) throw error;
            Logger.warn(`Retry ${i + 1} for /settings`, { error: error.message });
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          }
        }
      };

      const response = await fetchWithRetry().catch(() => {
        Logger.warn('Settings endpoint failed, using defaults');
        return { data: { siteTitle: 'Cleanup Tracker' } };
      });

      const settingsData = response.data || { siteTitle: 'Cleanup Tracker' };

      // Sanitize settings
      const sanitizedSettings = {
        ...settingsData,
        siteTitle: Security.sanitizeInput(settingsData.siteTitle || 'Cleanup Tracker'),
        theme: settingsData.theme || 'dark'
      };

      setSettings(sanitizedSettings);
      setError(null);

      const loadTime = performance.now() - startTime;
      Logger.info('Settings fetched successfully', {
        loadTime: `${loadTime.toFixed(2)}ms`,
        siteTitle: sanitizedSettings.siteTitle
      });
    } catch (err) {
      Logger.error('Failed to fetch settings', err, { userId: currentUser?.id });
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load settings';
      setError(errorMessage);
      // Keep default settings on error
      setSettings({ siteTitle: 'Cleanup Tracker' });
    } finally {
      setLoading(false);
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
