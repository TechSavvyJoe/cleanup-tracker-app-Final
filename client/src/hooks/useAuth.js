import { useState, useEffect, useCallback } from 'react';
import { V2 } from '../utils/v2Client';

const TOKEN_STORAGE_KEY = 'cleanupTracker.session';
const UNAUTHORIZED_EVENT = 'cleanup-tracker:unauthorized';

let refreshTokenValue = null;
let refreshRequest = null;

// Token management functions
export function setSessionTokens(tokens) {
  if (tokens?.accessToken) {
    V2.defaults.headers.common.Authorization = `Bearer ${tokens.accessToken}`;
  } else {
    delete V2.defaults.headers.common.Authorization;
  }
  refreshTokenValue = tokens?.refreshToken || null;
}

export function clearSessionTokens() {
  delete V2.defaults.headers.common.Authorization;
  refreshTokenValue = null;
}

export function persistSession(session) {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(session));
}

export function loadStoredSession() {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse stored session, clearing it.', err);
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
}

export function emitUnauthorizedLogout() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

// Axios interceptor setup (this should only run once)
let interceptorInitialized = false;

export function setupAuthInterceptor() {
  if (interceptorInitialized) return;
  interceptorInitialized = true;

  V2.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config || {};
      if (originalRequest.__skipAuthRefresh) {
        return Promise.reject(error);
      }

      const status = error.response?.status;
      const isAuthEndpoint = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh');

      if (status === 401 && refreshTokenValue && !originalRequest.__isRetryRequest && !isAuthEndpoint) {
        if (!refreshRequest) {
          refreshRequest = V2.post(
            '/auth/refresh',
            { refreshToken: refreshTokenValue },
            { __skipAuthRefresh: true }
          )
            .then((res) => {
              const tokens = {
                accessToken: res.data?.accessToken,
                refreshToken: res.data?.refreshToken
              };
              setSessionTokens(tokens);

              const stored = loadStoredSession();
              if (stored?.user) {
                persistSession({
                  ...stored,
                  tokens: {
                    ...stored.tokens,
                    ...tokens
                  }
                });
              }
              return tokens;
            })
            .catch((refreshErr) => {
              clearSessionTokens();
              persistSession(null);
              emitUnauthorizedLogout();
              throw refreshErr;
            })
            .finally(() => {
              refreshRequest = null;
            });
        }

        try {
          await refreshRequest;
          originalRequest.__isRetryRequest = true;
          originalRequest.headers = originalRequest.headers || {};
          if (V2.defaults.headers.common.Authorization) {
            originalRequest.headers.Authorization = V2.defaults.headers.common.Authorization;
          } else {
            delete originalRequest.headers.Authorization;
          }
          return V2(originalRequest);
        } catch (refreshErr) {
          return Promise.reject(refreshErr);
        }
      }

      if (status === 401 && !refreshTokenValue && !isAuthEndpoint) {
        clearSessionTokens();
        persistSession(null);
        emitUnauthorizedLogout();
      }

      return Promise.reject(error);
    }
  );
}

// Initialize interceptor immediately
setupAuthInterceptor();

// Custom hook for authentication
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Login handler
  const login = useCallback((sessionData) => {
    if (!sessionData?.user || !sessionData?.tokens) {
      console.error('Invalid session payload received on login', sessionData);
      setError('Login failed: unexpected response');
      return false;
    }

    setSessionTokens(sessionData.tokens);
    persistSession(sessionData);
    console.log('User login successful:', {
      userId: sessionData.user?.id,
      role: sessionData.user?.role,
      name: sessionData.user?.name
    });
    setUser(sessionData.user);
    setError(null);
    return true;
  }, []);

  // Logout handler
  const logout = useCallback((message) => {
    console.log('User logout');
    clearSessionTokens();
    persistSession(null);
    setUser(null);
    setError(message || null);
  }, []);

  // Load stored session on mount
  useEffect(() => {
    const stored = loadStoredSession();
    if (stored?.user && stored?.tokens) {
      setSessionTokens(stored.tokens);
      setUser(stored.user);
    }
    setLoading(false);
  }, []);

  // Listen for unauthorized events
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onUnauthorized = () => {
      logout('Your session expired. Please sign in again.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [logout]);

  return {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user
  };
}

export { UNAUTHORIZED_EVENT, TOKEN_STORAGE_KEY };
