import React, { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react';
import { useToast } from '../components/Toast';
import { V2, v2Request } from '../utils/v2Client';
import { setSessionTokens, clearSessionTokens, persistSession, loadStoredSession, UNAUTHORIZED_EVENT } from '../hooks/useAuth';

// 🎨 Modern Design System

// ⚙️ Settings Panel
import SettingsPanel from '../components/SettingsPanel';

// 📊 Enhanced Reports Component
import EnterpriseInventory from '../components/EnterpriseInventory';

// 🚀 Premium Enterprise Components - Currently Integrated
import {
  SkeletonLoader,
  CommandPalette
} from '../components/PremiumUI';

import DetailerDashboard from '../views/detailer/DetailerDashboard';
import DetailerNewJob from '../views/detailer/DetailerNewJob';
import SalespersonDashboard from '../views/salesperson/SalespersonDashboard';
import ManagerDashboard from '../views/manager/ManagerDashboard';
import JobsView from '../views/shared/JobsView';
import UsersView from '../views/shared/UsersView';
import ReportsView from '../views/shared/ReportsView';
import SettingsView from '../views/shared/SettingsView';
import MySettingsView from '../views/shared/MySettingsView';
import QCView from '../views/shared/QCView';
import { ensureServiceTypeCatalog, DEFAULT_SERVICE_TYPES } from '../utils/serviceTypes';

// Professional error logging and performance monitoring
const Logger = {
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

// Security: Input sanitization utilities
const Security = {
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>]/g, '') // Basic XSS prevention
      .trim()
      .slice(0, 1000); // Prevent extremely long inputs
  },
  
  sanitizeHtml: (html) => {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },
  
  validateVin: (vin) => {
    if (!vin || typeof vin !== 'string') return false;
    // VIN validation: 17 characters, alphanumeric except I, O, Q
    return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
  }
};

// Utility functions for date/time handling with Eastern Time support
const DateUtils = {
  // Get current local date in YYYY-MM-DD format (Eastern Time)
  getLocalDateString: (date = new Date()) => {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
      .toISOString().slice(0, 10);
  },
  
  // Check if date is today (Eastern Time)
  isToday: (date) => {
    if (!date) return false;
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return false;
    return DateUtils.getLocalDateString(inputDate) === DateUtils.getLocalDateString();
  },
  
  // Check if date is this week (Eastern Time)
  isThisWeek: (date) => {
    if (!date) return false;
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return false;
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000));
    return inputDate >= weekStart && inputDate < weekEnd;
  },
  
  // Check if date is this month (Eastern Time)
  isThisMonth: (date) => {
    if (!date) return false;
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) return false;
    const now = new Date();
    return inputDate.getMonth() === now.getMonth() && inputDate.getFullYear() === now.getFullYear();
  },
  
  // Format date safely
  formatDate: (date, options = {}) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      ...options 
    });
  },
  
  // Format duration from minutes to readable format
  formatDuration: (minutes) => {
    if (!minutes || minutes < 0) return 'N/A';
    // Cap unrealistic durations at 24 hours
    const cappedMinutes = Math.min(minutes, 24 * 60);
    const hours = Math.floor(cappedMinutes / 60);
    const mins = Math.round(cappedMinutes % 60);
    if (hours === 0) return `${mins}min`;
    return `${hours}h ${mins}m`;
  },
  
  // Calculate duration between two dates in minutes
  calculateDuration: (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    // Cap at 24 hours to prevent unrealistic durations
    return Math.max(0, Math.min(diffMins, 24 * 60));
  },
  
  // Validate if a date string/object is valid
  isValidDate: (date) => {
    if (!date) return false;
    const d = new Date(date);
    return !isNaN(d.getTime());
  },

  // Format date and time for display
  formatDateTime: (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  },

  // Get a valid date from various formats
  getValidDate: (date) => {
    if (!date) return null;
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
};

const buildVehicleSummary = (job = {}) => {
  const vehicle = job.vehicle || {};
  const year = (vehicle.year ?? job.year ?? '').toString().trim();
  const make = (vehicle.make ?? job.make ?? '').toString().trim();
  const model = (vehicle.model ?? job.model ?? '').toString().trim();
  const description = (vehicle.description ?? job.vehicleDescription ?? '').trim();
  const color = (vehicle.color ?? job.vehicleColor ?? job.color ?? '').toString().trim();
  const stockNumber = vehicle.stockNumber ?? job.stockNumber;
  const vin = (vehicle.vin ?? job.vin ?? '').toString().trim();

  const headlineParts = [year, make, model].filter(Boolean);
  const headline = headlineParts.join(' ');

  if (headline) {
    return color ? `${headline} • ${color}` : headline;
  }

  if (description) {
    return color ? `${description} • ${color}` : description;
  }

  if (stockNumber) {
    return `Stock ${stockNumber}`;
  }

  if (vin) {
    return `VIN ${vin.slice(-6)}`;
  }

  return 'Vehicle';
};

const normalizeJobRecord = (job = {}) => {
  const vehicle = {
    year: job.vehicle?.year ?? job.year ?? '',
    make: job.vehicle?.make ?? job.make ?? '',
    model: job.vehicle?.model ?? job.model ?? '',
    color: job.vehicle?.color ?? job.vehicleColor ?? job.color ?? '',
    stockNumber: job.vehicle?.stockNumber ?? job.stockNumber ?? '',
    vin: job.vehicle?.vin ?? job.vin ?? '',
    description: job.vehicle?.description ?? job.vehicleDescription ?? ''
  };

  const vehicleSummary = job.vehicleSummary || buildVehicleSummary({ ...job, vehicle });
  const technicianSessions = Array.isArray(job.technicianSessions) ? job.technicianSessions : [];
  const activeTechnicians = Array.isArray(job.activeTechnicians) ? job.activeTechnicians : [];
  const assignedTechnicianIds = Array.isArray(job.assignedTechnicianIds)
    ? job.assignedTechnicianIds.map((value) => (value != null ? String(value) : value))
    : [];

  return {
    ...job,
    vehicle,
    vehicleSummary,
    technicianSessions,
    activeTechnicians,
    assignedTechnicianIds
  };
};

// 🎨 BILLION DOLLAR TECH COMPANY LOGIN - ULTRA PREMIUM DESIGN
function LoginForm({ onLogin }) {
  const [employeeId, setEmployeeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (pinToSubmit) => {
    const pin = pinToSubmit || employeeId;
    setError('');

    if (!pin) {
      setError('Please enter your PIN');
      return;
    }

    if (!/^[0-9]{4}$/.test(pin)) {
      setError('PIN must be 4 digits');
      return;
    }

    setIsLoading(true);
    try {
      const response = await v2Request('post', '/auth/login', { 
        employeeId: pin, 
        pin: pin 
      }, {
        timeout: 10000 // 10 second timeout to prevent 504
      });
      const session = response.data;
      
      if (session?.user && session?.tokens?.accessToken) {
        // Login tracked by Logger.info in handleLogin
        onLogin(session);
        setEmployeeId('');
        setError('');
      } else {
        setError('Invalid login response from server');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Login failed. Please try again.';
      setError(errorMsg);
      setEmployeeId(''); // Clear on error so user can try again
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, onLogin]);

  // Add keyboard support for number entry
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isLoading) return;
      
      // Number keys (0-9)
      if (e.key >= '0' && e.key <= '9') {
        if (employeeId.length < 4) {
          setEmployeeId(prev => prev + e.key);
          setError(''); // Clear error on input
        }
      }
      // Backspace or Delete
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        setEmployeeId(prev => prev.slice(0, -1));
        setError('');
      }
      // Escape to clear
      else if (e.key === 'Escape') {
        setEmployeeId('');
        setError('');
      }
      // Enter to submit
      else if (e.key === 'Enter' && employeeId.length === 4) {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [employeeId, isLoading, handleSubmit]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Mobile-Optimized Main Content - Single Screen, No Scroll */}
      <div className="relative z-10 h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center justify-center">
            
            {/* X.com Style Login - Single Screen */}
            <div className="w-full max-w-md">
              <div className="relative">
                {/* Main Card - Pure Black X.com Style */}
                <div className="relative bg-black p-6 animate-scale-in">

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Message */}
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-red-400 font-medium text-sm">{error}</p>
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      {/* Large PIN Display - X.com Style */}
                      <div className="relative mb-8">
                        <div className="relative bg-black border border-gray-800 rounded-2xl py-8 px-6">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-4 min-h-[80px]">
                              {[0, 1, 2, 3].map((index) => (
                                <div
                                  key={index}
                                  className={`relative w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold transition-all duration-300 ${
                                    employeeId[index] 
                                      ? 'bg-gray-900 border-gray-700 text-white shadow-xl' 
                                      : 'bg-black border-gray-800 text-gray-700'
                                  }`}
                                >
                                  {employeeId[index] ? (
                                    <div className="relative">
                                      <div className="w-4 h-4 bg-black rounded-full"></div>
                                    </div>
                                  ) : (
                                    <span className="text-2xl font-bold text-gray-800">{index + 1}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Compact Professional Dial Pad */}
                      <div className="space-y-2 max-w-xs mx-auto mb-4">
                        {/* Row 1: 1, 2, 3 */}
                        <div className="flex justify-center gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '1';
                                setEmployeeId(newPin);
                                setError('');
                                // Auto-submit when 4 digits entered
                                if (newPin.length === 4) {
                                  setTimeout(() => handleSubmit(newPin), 300);
                                }
                              }
                            }}
                            className="relative group h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl text-3xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">1</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '2';
                                setEmployeeId(newPin);
                                setError('');
                                if (newPin.length === 4) {
                                  setTimeout(() => handleSubmit(newPin), 300);
                                }
                              }
                            }}
                            className="relative group h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl text-3xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">2</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '3';
                                setEmployeeId(newPin);
                                setError('');
                                if (newPin.length === 4) {
                                  setTimeout(() => handleSubmit(newPin), 300);
                                }
                              }
                            }}
                            className="relative group h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl text-3xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">3</span>
                          </button>
                        </div>
                        
                        {/* Row 2: 4, 5, 6 */}
                        <div className="flex justify-center gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '4';
                                setEmployeeId(newPin);
                                setError('');
                                if (newPin.length === 4) setTimeout(() => handleSubmit(newPin), 300);
                              }
                            }}
                            className="h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">4</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '5';
                                setEmployeeId(newPin);
                                setError('');
                                if (newPin.length === 4) setTimeout(() => handleSubmit(newPin), 300);
                              }
                            }}
                            className="h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">5</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '6';
                                setEmployeeId(newPin);
                                setError('');
                                if (newPin.length === 4) setTimeout(() => handleSubmit(newPin), 300);
                              }
                            }}
                            className="h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">6</span>
                          </button>
                        </div>
                        
                        {/* Row 3: 7, 8, 9 */}
                        <div className="flex justify-center gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '7';
                                setEmployeeId(newPin);
                                setError('');
                                if (newPin.length === 4) setTimeout(() => handleSubmit(newPin), 300);
                              }
                            }}
                            className="h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">7</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '8';
                                setEmployeeId(newPin);
                                setError('');
                                if (newPin.length === 4) setTimeout(() => handleSubmit(newPin), 300);
                              }
                            }}
                            className="h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">8</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '9';
                                setEmployeeId(newPin);
                                setError('');
                                if (newPin.length === 4) setTimeout(() => handleSubmit(newPin), 300);
                              }
                            }}
                            className="h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">9</span>
                          </button>
                        </div>
                        
                        {/* Row 4: Clear, 0, Delete */}
                        <div className="flex justify-center gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              setEmployeeId('');
                              setError('');
                            }}
                            className="h-20 w-20 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border-2 border-red-500 hover:border-red-400 rounded-2xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                            title="Clear All"
                          >
                            <span className="text-4xl">✕</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (employeeId.length < 4) {
                                const newPin = employeeId + '0';
                                setEmployeeId(newPin);
                                setError('');
                                if (newPin.length === 4) setTimeout(() => handleSubmit(newPin), 300);
                              }
                            }}
                            className="h-20 w-20 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-2 border-gray-700 hover:border-gray-600 rounded-2xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                          >
                            <span className="text-4xl">0</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEmployeeId(employeeId.slice(0, -1));
                              setError('');
                            }}
                            className="h-20 w-20 bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 border-2 border-orange-500 hover:border-orange-400 rounded-2xl font-bold text-white transition-all duration-200 shadow-xl hover:shadow-2xl active:scale-95 flex items-center justify-center"
                            title="Delete Last"
                          >
                            <span className="text-4xl">⌫</span>
                          </button>
                        </div>
                      </div>

                      {/* Keyboard Hint */}
                      <div className="text-center mb-4">
                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2 font-medium">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                          <span>Use keyboard or touch for PIN entry</span>
                        </p>
                      </div>
                    </div>

                    {/* Auto-Login Status */}
                    <div className="w-full py-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-3 py-4">
                          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-xl font-semibold text-white">Signing In...</span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 text-center font-medium">
                          Auto-login enabled
                        </p>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Component with Mobile-First Design
function MainApp({ user, onLogout, onError, showCommandPalette, setShowCommandPalette }) {
  const [view, setView] = useState('dashboard');
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [settings, setSettings] = useState({
    siteTitle: 'CleanUp Tracker',
    serviceTypes: DEFAULT_SERVICE_TYPES
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [componentError, setComponentError] = useState(null);
  // Sidebar visibility: default hidden on mobile, shown on large screens
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  
  // 🎨 Force Dark Mode - X.com/Twitter Styling
  const [theme] = useState('dark'); // Locked to dark mode
  const [showSettings, setShowSettings] = useState(false);
  const siteTitle = useMemo(() => (
  settings?.siteTitle && settings.siteTitle.trim() ? settings.siteTitle.trim() : 'CleanUp Tracker'
  ), [settings?.siteTitle]);
  const corporateMark = useMemo(() => {
    const words = siteTitle.split(' ').filter(Boolean);
    if (words.length === 0) {
      return { lead: 'Cleanup', tail: 'Tracker' };
    }
    if (words.length === 1) {
      return { lead: words[0], tail: '' };
    }
    return {
      lead: words[0],
      tail: words.slice(1).join(' ')
    };
  }, [siteTitle]);
  const viewTitle = useMemo(() => {
    const mapping = {
      dashboard: 'Dashboard',
      jobs: (user.role === 'detailer' || user.role === 'technician') ? 'New Job' : 'Job Management',
      qc: 'Quality Control',
      reports: 'Analytics',
      users: 'Team',
      settings: 'System Settings',
      me: 'Profile'
    };
    const label = mapping[view];
    if (label) return label;
    if (view) return view.charAt(0).toUpperCase() + view.slice(1);
    return 'Overview';
  }, [view, user.role]);
  const serviceCatalog = useMemo(() => (
    ensureServiceTypeCatalog(settings?.serviceTypes || DEFAULT_SERVICE_TYPES)
  ), [settings]);
  const defaultServiceType = useMemo(() => (
    serviceCatalog.find((entry) => entry.isActive !== false) || serviceCatalog[0] || null
  ), [serviceCatalog]);
  const previousViewRef = useRef(view);
  useEffect(() => {
    if (previousViewRef.current !== view) {
      previousViewRef.current = view;
      closeSidebar();
    }
  }, [view, closeSidebar]);
  const sidebarDisplayClass = useMemo(() => (
    isSidebarOpen
      ? 'translate-x-0 opacity-100 pointer-events-auto'
      : '-translate-x-full opacity-0 pointer-events-none'
  ), [isSidebarOpen]);
  
  // Apply dark theme permanently
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    localStorage.setItem('app-theme', 'dark');
    // Apply X.com black background
    document.body.className = 'dark bg-black';
    document.body.style.backgroundColor = '#000000';
  }, []);

  // Adjust sidebar visibility when resizing to mobile widths
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        closeSidebar();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [closeSidebar]);

  // Close sidebar with Escape key
  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen, closeSidebar]);

  // Enhanced toast toast system
  const toast = useToast();

  // Global error handler with proper error boundary
  const handleError = useCallback((error, errorInfo) => {
    console.error('Component error:', error, errorInfo);
    setComponentError(error.message);
    toast.error('Something went wrong. Please refresh the page.');
  }, [toast]);

  // Error boundary effect
  useEffect(() => {
    const handleUnhandledError = (event) => {
      handleError(event.error, { componentStack: event.filename });
    };

    const handleUnhandledRejection = (event) => {
      handleError(event.reason, { componentStack: 'Promise rejection' });
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [handleError]);

  // Load initial data with useCallback to prevent re-renders
  const loadInitialData = useCallback(async () => {
    // Authentication check - prevent API calls without valid user
    if (!user || !user.id) {
      Logger.warn('LoadInitialData called without authenticated user - aborting');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      Logger.info('Loading initial data');
      
      // Performance monitoring for data loading
      const startTime = performance.now();
      
      // Enhanced error handling with retries for network failures
      const fetchWithRetry = async (url, retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            return await V2.get(url);
          } catch (error) {
            if (i === retries) throw error;
            Logger.warn(`Retry ${i + 1} for ${url}`, { error: error.message });
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          }
        }
      };

      const [jobsRes, usersRes, settingsRes] = await Promise.all([
        fetchWithRetry('/jobs'),
        fetchWithRetry('/users'),
        fetchWithRetry('/settings').catch(() => {
          Logger.warn('Settings endpoint failed, using defaults');
          return {
            data: {
              siteTitle: 'CleanUp Tracker',
              serviceTypes: DEFAULT_SERVICE_TYPES
            }
          };
        })
      ]);
      
      // Data validation and sanitization
      const jobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
      const normalizedJobs = jobs.map(normalizeJobRecord);
      const usersArray = Array.isArray(usersRes.data) ? usersRes.data : [];
  const settings = settingsRes.data || {
    siteTitle: 'CleanUp Tracker',
    serviceTypes: DEFAULT_SERVICE_TYPES
  };

      // Performance optimization: batch state updates
      setJobs(normalizedJobs);
      
      // Enhanced user data processing with validation
      const usersObj = {};
      usersArray.forEach(user => {
        const userId = user?.id || user?._id;
        if (user && userId) {
          // Sanitize user data
          usersObj[String(userId)] = {
            ...user,
            name: Security.sanitizeInput(user.name || 'Unknown'),
            role: user.role || 'detailer'
          };
        }
      });
      setUsers(usersObj);
      
      // Sanitize settings
      const sanitizedSettings = {
        ...settings,
        siteTitle: Security.sanitizeInput(settings.siteTitle || 'CleanUp Tracker'),
        theme: settings.theme || 'light',
        serviceTypes: ensureServiceTypeCatalog(settings.serviceTypes || DEFAULT_SERVICE_TYPES)
      };
      setSettings(sanitizedSettings);

      // Theme is locked to dark mode - ignore saved theme preferences
      
      setError(null);
      
      // Performance logging
      const loadTime = performance.now() - startTime;
      Logger.info('Data loading completed', {
        loadTime: `${loadTime.toFixed(2)}ms`,
        jobCount: normalizedJobs.length,
        userCount: usersArray.length
      });
      
      if (loadTime > 2000) {
        Logger.warn('Slow data loading detected', { loadTime: `${loadTime.toFixed(2)}ms` });
      }
      
    } catch (err) {
      Logger.error('Failed to load initial data', err, {
        userId: user?.id,
        retryCount: 1
      });
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load data';
      setError(errorMessage);
      // Use try-catch for toast to prevent further errors
      try {
        toast.error('Failed to load data. Please try again.');
      } catch (toastError) {
        Logger.warn('Failed to show toast', toastError);
      }

      // Report to parent component if provided
      if (onError) {
        try {
          onError(errorMessage, err);
        } catch (callbackError) {
          Logger.warn('Failed to call onError callback', callbackError);
        }
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependencies to prevent infinite loops

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Connection lost - working offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Load data on mount and set up auto-refresh with authentication check
  useEffect(() => {
    // Add a small delay to ensure authentication state is stable
    const timer = setTimeout(() => {
      if (user && user.id) {
        Logger.info('Starting initial data load for authenticated user', { userId: user.id });
        loadInitialData();
      } else {
        Logger.warn('Skipping initial data load - user not authenticated');
      }
    }, 100); // 100ms delay to ensure authentication is stable

    // Set up auto-refresh every 30 seconds for real-time updates
    const refreshInterval = setInterval(() => {
      if (!loading && user && user.id) {
        loadInitialData();
      }
    }, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(refreshInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user to prevent infinite loops

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Only handle shortcuts if not typing in an input
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'r':
            event.preventDefault();
            loadInitialData();
            toast.success('Data refreshed');
            break;
          case '1':
            event.preventDefault();
            setView('dashboard');
            closeSidebar();
            break;
          case '2':
            event.preventDefault();
            if (user.role !== 'detailer') setView('jobs');
            else setView('jobs');
            closeSidebar();
            break;
          case '3':
            event.preventDefault();
            if (user.role === 'manager') setView('users');
            closeSidebar();
            break;
          case '4':
            event.preventDefault();
            if (user.role === 'manager') setView('reports');
            closeSidebar();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role, closeSidebar]); // Removed loadInitialData and toast to prevent loops

    // One-time inventory warm-up: if first search returns empty and not yet warmed, trigger refresh
    useEffect(() => {
      (async () => {
        try {
          // quick diag call to see if vehicles exist
          const d = await V2.get('/diag');
          if (d.data && typeof d.data.vehicles === 'number' && d.data.vehicles === 0) {
            await V2.post('/vehicles/refresh');
          }
    // no-op
        } catch (_) {
          // ignore warm-up errors; user can still search or manual refresh
    // no-op
        }
      })();
    }, []);



  // Allow detailers to freely navigate; no forced redirect.

  // Search functionality
  // Enhanced search functionality with comprehensive validation and error handling
  const handleSearch = useCallback(async (term) => {
    try {
      // Input validation and sanitization
      if (!term || typeof term !== 'string') {
        Logger.warn('Invalid search term provided', { term });
        return;
      }
      
      const sanitizedTerm = Security.sanitizeInput(term.trim());
      if (!sanitizedTerm) {
        toast.warning('Please enter a search term');
        return;
      }
      
      // Length validation for performance
      if (sanitizedTerm.length > 50) {
        toast.warning('Search term too long. Please enter a shorter term.');
        return;
      }
      
      Logger.info('Vehicle search initiated', { 
        searchTerm: sanitizedTerm,
        length: sanitizedTerm.length,
        userId: user.id
      });
      
      setIsSearching(true);
      
      // Performance monitoring for search operations
      const results = await Logger.perf(`vehicle-search-${sanitizedTerm}`, async () => {
        try {
          const response = await V2.get(`/vehicles/search?q=${encodeURIComponent(sanitizedTerm)}`);
          return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
          // Enhanced error handling with specific error types
          if (error.response?.status === 429) {
            throw new Error('Search rate limit exceeded. Please wait a moment and try again.');
          } else if (error.response?.status >= 500) {
            throw new Error('Server error occurred. Please try again later.');
          } else if (!navigator.onLine) {
            throw new Error('No internet connection. Please check your connection and try again.');
          } else {
            throw new Error(error.response?.data?.error || error.message || 'Search failed');
          }
        }
      });
      
      setSearchResults(results);
      setHasSearched(true);
      
      // User feedback based on results
      if (results.length === 0) {
        toast.info(`No vehicles found for "${sanitizedTerm}". Try a different search term.`);
        Logger.info('Search returned no results', { searchTerm: sanitizedTerm });
      } else {
        toast.success(`Found ${results.length} vehicle(s)`);
        Logger.info('Search completed successfully', { 
          searchTerm: sanitizedTerm,
          resultCount: results.length 
        });
      }
      
    } catch (error) {
      Logger.error('Search operation failed', error, { 
        searchTerm: term,
        userId: user.id 
      });
      
      setSearchResults([]);
      setHasSearched(true);
      toast.error(error.message || 'Search failed. Please try again.');
      
    } finally {
      setIsSearching(false);
    }
  }, [user.id, toast]);

  // Enhanced debounced auto-search with professional error handling and performance optimization
  useEffect(() => {
    const sanitizedTerm = Security.sanitizeInput(searchTerm.trim());
    
    if (!sanitizedTerm) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    
    // Intelligent search trigger logic - immediate for VINs, debounced for others
    const isVinLength = sanitizedTerm.length === 17;
    const isValidVin = Security.validateVin(sanitizedTerm);
    const shouldSearch = isVinLength || sanitizedTerm.length >= 3;
    
    if (!shouldSearch) return;
    
    const controller = new AbortController();
    
    // Shorter delay for VINs, longer for regular searches to reduce server load
    const searchDelay = (isVinLength && isValidVin) ? 100 : 600;
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      
      try {
        Logger.info('Auto-search triggered', { 
          searchTerm: sanitizedTerm, 
          isVin: isValidVin,
          userId: user.id 
        });
        
        const response = await Logger.perf(`auto-search-${sanitizedTerm}`, async () => {
          return await V2.get(`/vehicles/search?q=${encodeURIComponent(sanitizedTerm)}`, { 
            signal: controller.signal,
            timeout: 10000 // 10 second timeout for auto-search
          });
        });
        
        const results = Array.isArray(response.data) ? response.data : [];
        setSearchResults(results);
        setHasSearched(true);
        
        Logger.info('Auto-search completed', { 
          searchTerm: sanitizedTerm,
          resultCount: results.length
        });
        
      } catch (error) {
        if (error.name === 'CanceledError') {
          Logger.info('Auto-search cancelled', { searchTerm: sanitizedTerm });
          return;
        }
        
        Logger.warn('Auto-search failed', error, { 
          searchTerm: sanitizedTerm,
          userId: user.id 
        });
        
        setSearchResults([]);
        setHasSearched(true);
        
        // Don't show toasts for auto-search failures to avoid spam
        if (error.response?.status >= 500) {
          toast.warning('Server temporarily unavailable');
        }
      } finally {
        setIsSearching(false);
      }
    }, searchDelay);
    
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchTerm, user.id, toast]);

  // Scan success handler
  // Enhanced VIN scanner success handler with comprehensive validation
  const handleScanSuccess = useCallback(async (scannedVin) => {
    setShowScanner(false);
    
    try {
      // Input validation and sanitization
      if (!scannedVin) {
        throw new Error('No VIN provided');
      }
      
      const vin = Security.sanitizeInput(scannedVin.toString().toUpperCase().trim());
      
      // Professional VIN validation
      if (!Security.validateVin(vin)) {
        Logger.warn('Invalid VIN scanned', { vin, userId: user.id });
        toast.warning('Invalid VIN format. Please scan again or enter manually.');
        return;
      }
      
      Logger.info('VIN scan successful', { vin, userId: user.id });
      
      // Performance monitoring for VIN operations
      await Logger.perf(`join-by-vin-${vin}`, async () => {
        try {
          // Try to join an in-progress job by VIN
          await V2.put('/vehicles/join-by-vin', { 
            vin, 
            userId: user.id,
            timestamp: new Date().toISOString()
          });
          
          await loadInitialData();
          setSearchTerm(vin);
          setView('dashboard');
          closeSidebar();
          toast.success('Successfully joined existing job!');
          
        } catch (joinError) {
          // Graceful fallback to vehicle search
          Logger.info('No existing job found, searching vehicles', { vin });
          
          try {
            const searchResponse = await Logger.perf(`vehicle-search-${vin}`, async () => {
              return await V2.get(`/vehicles/search?q=${encodeURIComponent(vin)}`);
            });
            
            const results = Array.isArray(searchResponse.data) ? searchResponse.data : [];
            setSearchResults(results);
            setSearchTerm(vin);
            setHasSearched(true);
            setView('jobs');
            closeSidebar();
            
            if (results.length === 0) {
              toast.warning('No vehicles found with this VIN. Please verify and try again.');
            } else {
              toast.success(`Found ${results.length} vehicle(s)`);
            }
            
          } catch (searchError) {
            throw new Error(`Vehicle lookup failed: ${searchError.response?.data?.error || searchError.message}`);
          }
        }
      });
      
    } catch (error) {
      Logger.error('VIN scan processing failed', error, { 
        vin: scannedVin, 
        userId: user.id 
      });
      
      const errorMessage = error.message || 'VIN processing failed';
      toast.error(errorMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]); // Removed loadInitialData and toast to prevent loops

  // Stop work handler
  const handleStopWork = async () => {
    try {
      const activeJob = jobs.find(j => j.status === 'In Progress' && (
        j.assignedTechnicianIds?.includes(user.id) || 
        j.technicianId === user.id ||
        j.technicianId === user.pin
      ));
      if (!activeJob) return;
      
      // Stop timer and mark as complete with proper timing
      await V2.put(`/jobs/${activeJob.id}/complete`, { 
        userId: user.id,
        completedAt: new Date().toISOString() 
      });
      
      await loadInitialData(); // Reload data
      toast.success('Job completed successfully! 🎉');
    } catch (err) {
      toast.error('Failed to complete job: ' + (err.response?.data?.error || err.message));
    }
  };

  // Delete user handler
  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this detailer?')) return;
    
    try {
      await V2.delete(`/users/${userId}`);
      await loadInitialData(); // Reload data
      alert('Detailer deleted successfully');
    } catch (err) {
      alert('Failed to delete detailer: ' + (err.response?.data?.error || err.message));
    }
  };

  // Enhanced computed values with performance optimizations
  // Treat QC returns and pause states as active so detailers can resume work without hunting for jobs in other lists
  const ACTIVE_JOB_STATUSES = useMemo(() => new Set(['In Progress', 'QC Required', 'Paused']), []);
  const COMPLETED_JOB_STATUSES = useMemo(() => new Set(['Completed', 'QC Approved']), []);

  const activeJobs = useMemo(() => 
    jobs.filter(j => ACTIVE_JOB_STATUSES.has(j.status)), 
    [jobs, ACTIVE_JOB_STATUSES]
  );
  
  const completedJobs = useMemo(() => 
    jobs.filter(j => COMPLETED_JOB_STATUSES.has(j.status)), 
    [jobs, COMPLETED_JOB_STATUSES]
  );
  
  const userActiveJob = useMemo(() => 
    activeJobs.find(j => 
      j.assignedTechnicianIds?.includes(user.id) || 
      j.technicianId === user.id ||
      j.technicianId === user.pin
    ), 
    [activeJobs, user.id, user.pin]
  );

  // Performance dashboard stats with advanced analytics
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    
    const todayJobs = completedJobs.filter(job => 
      job.completedAt && new Date(job.completedAt).toDateString() === today
    );
    
    const weekJobs = completedJobs.filter(job => 
      job.completedAt && new Date(job.completedAt) >= thisWeekStart
    );

    // Calculate efficiency metrics
    const calculateAverageTime = (jobList) => {
      if (jobList.length === 0) return 0;
      const totalTime = jobList.reduce((sum, job) => {
        if (job.startedAt && job.completedAt) {
          return sum + (new Date(job.completedAt) - new Date(job.startedAt));
        }
        return sum;
      }, 0);
      return Math.round(totalTime / jobList.length / (1000 * 60)); // Convert to minutes
    };

    return {
      totalActive: activeJobs.length,
      totalCompleted: completedJobs.length,
      todayCompleted: todayJobs.length,
      weekCompleted: weekJobs.length,
      averageTimeToday: calculateAverageTime(todayJobs),
      averageTimeWeek: calculateAverageTime(weekJobs),
      efficiency: weekJobs.length > 0 ? Math.round((todayJobs.length / (weekJobs.length / 7)) * 100) : 0,
      qcRequired: jobs.filter(job => job.status === 'QC Required').length
    };
  }, [activeJobs, completedJobs, jobs]);
  const detailers = useMemo(() => 
    Object.values(users).filter(u => u.role === 'detailer'), 
    [users]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
        {/* Enterprise Loading State */}
        <div className="w-72 bg-black shadow-2xl border-r border-gray-800">
          {/* Sidebar Skeleton */}
          <div className="p-6 border-b border-gray-800">
            <SkeletonLoader className="h-12 w-12 rounded-2xl mb-3" />
            <SkeletonLoader className="h-6 w-32 mb-2" />
            <SkeletonLoader className="h-4 w-24" />
          </div>
          <div className="p-5 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonLoader className="h-10 w-10 rounded-xl" />
                <div className="flex-1">
                  <SkeletonLoader className="h-4 w-24 mb-1" />
                  <SkeletonLoader className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Main Content Skeleton */}
        <div className="flex-1 p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <SkeletonLoader className="h-16 w-16 rounded-3xl" />
              <div>
                <SkeletonLoader className="h-8 w-48 mb-2" />
                <SkeletonLoader className="h-5 w-32" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1,2].map(i => (
                <div key={i} className="bg-black rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center gap-4 mb-4">
                    <SkeletonLoader className="h-14 w-14 rounded-2xl" />
                    <div>
                      <SkeletonLoader className="h-4 w-24 mb-2" />
                      <SkeletonLoader className="h-8 w-16" />
                    </div>
                  </div>
                  <SkeletonLoader className="h-20 w-full rounded-2xl" />
                </div>
              ))}
            </div>
            
            <div className="bg-black rounded-3xl p-8 shadow-2xl">
              <SkeletonLoader className="h-6 w-48 mb-6" />
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50">
                    <SkeletonLoader className="h-12 w-12 rounded-xl" />
                    <div className="flex-1">
                      <SkeletonLoader className="h-5 w-64 mb-2" />
                      <SkeletonLoader className="h-4 w-48" />
                    </div>
                    <SkeletonLoader className="h-8 w-20 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Loading Animation Overlay */}
          <div className="fixed bottom-8 right-8">
            <div className="bg-black rounded-2xl p-4 shadow-2xl border border-gray-800 flex items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="font-semibold text-white">Loading Dashboard</p>
                <p className="text-sm text-gray-600">Preparing your workspace...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-black rounded-xl p-6 border border-red-200 shadow-lg max-w-md">
          <h2 className="text-red-800 font-semibold text-lg mb-2">Error</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button 
            onClick={loadInitialData}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Error boundary wrapper
  if (componentError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-black rounded-xl p-8 shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Oops! Something went wrong</h3>
          <p className="text-gray-600 mb-4">{componentError}</p>
          <button 
            onClick={() => {
              setComponentError(null);
              window.location.reload();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Network Status Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 text-center text-sm font-medium z-50">
          <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636L5.636 18.364M12 2.05v19.9M2.05 12h19.9" />
          </svg>
          No internet connection - working offline
        </div>
      )}

      {/* X.com-Style Overlay - clicks close sidebar */}
      <div
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closeSidebar}
      />

      {/* Sidebar - X.com style, slides in from left */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-black border-r border-gray-800 flex flex-col transform transition-all duration-200 ease-out will-change-transform ${sidebarDisplayClass}`}
      >
        {/* Logo & Brand - X.com compact header */}
        <div className="p-4 border-b border-gray-800 bg-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl ring-1 ring-white/10 shadow-lg shadow-blue-500/30 bg-black">
              <img src="/brand.svg" alt="Cleanup Tracker" className="w-11 h-11 rounded-2xl hidden sm:block" onError={(e)=>{e.currentTarget.style.display='none';}}/>
              <div className="sm:hidden flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7.5c-1.2-2.1-3.4-3.5-6-3.5-3.9 0-7 3.1-7 7s3.1 7 7 7c2.6 0 4.8-1.4 6-3.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7v10" />
                </svg>
              </div>
            </div>
            <div className="leading-tight">
              <span className="block text-lg font-semibold text-white leading-tight">
                {corporateMark.lead}
                {corporateMark.tail && <span className="text-gray-400"> {corporateMark.tail}</span>}
              </span>
              <span className="block text-[9px] uppercase tracking-[0.38em] text-sky-400">Operations Hub</span>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="p-2 rounded-full hover:bg-gray-900 text-gray-400 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* User Profile - X.com compact */}
        <div className="px-4 py-3 border-b border-gray-800 bg-black flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-500">{user.role}</p>
          </div>
        </div>

        {/* Navigation Menu - X.com minimalist */}
        <nav className="flex-1 px-2 py-2">
          <button 
            onClick={() => { setView('dashboard'); closeSidebar(); }} 
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-colors ${
              view === 'dashboard' 
                ? 'bg-gray-900 text-white' 
                : 'text-gray-300 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            </svg>
            <span>Dashboard</span>
          </button>
          
          {(user.role === 'detailer' || user.role === 'technician') ? (
            <>
              <button 
                onClick={() => { setView('jobs'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'jobs' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">New Job</div>
                </div>
              </button>
              <button 
                onClick={() => { setView('me'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'me' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">Profile</div>
                </div>
              </button>
            </>
          ) : user.role === 'salesperson' ? (
            <>
              <button 
                onClick={() => { setView('me'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'me' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">Profile</div>
                </div>
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => { setView('jobs'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'jobs' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">Job Management</div>
                </div>
              </button>
              <button 
                onClick={() => { setView('qc'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'qc' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">Quality Control</div>
                </div>
              </button>
              <button 
                onClick={() => { setView('reports'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'reports' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold">Analytics</div>
                </div>
              </button>
              <button 
                onClick={() => { setView('inventory'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'inventory' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">Inventory</div>
                </div>
              </button>
              <button 
                onClick={() => { setView('users'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'users' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">Team Management</div>
                </div>
              </button>
              <button 
                onClick={() => { setView('settings'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'settings' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">System Settings</div>
                </div>
              </button>
              <button 
                onClick={() => { setView('me'); closeSidebar(); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 ${
                  view === 'me' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">Profile</div>
                </div>
              </button>
            </>
          )}
        </nav>

        {/* Bottom Section - Settings & Logout */}
        <div className="p-5 border-t border-gray-800 space-y-1">
          <button
            onClick={() => {
              closeSidebar();
              setShowSettings(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 text-gray-300 hover:bg-gray-900 hover:text-white"
          >
            <div>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
            </div>
            <span className="font-semibold text-sm">Preferences</span>
          </button>
          
          <button 
            onClick={() => {
              closeSidebar();
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 text-gray-300 hover:bg-gray-900 hover:text-white"
          >
            <div>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="font-semibold text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentTheme={theme}
        onThemeChange={() => {}} // Theme locked to dark mode
        userRole={user.role}
      />

      {/* Main App Container */}
      <div className="min-h-screen bg-black flex flex-1">
        {/* Main Content Area - X.com Style */}
        <div className="flex-1 bg-black overflow-y-auto">
          {/* Top Header Bar - X.com minimalist */}
          <div className="bg-black border-b border-gray-800 px-4 py-3 sticky top-0 z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  className="p-2 rounded-full hover:bg-gray-900 text-gray-400 hover:text-white"
                  onClick={toggleSidebar}
                  aria-label="Menu"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-2xl ring-1 ring-white/10 shadow-lg shadow-blue-500/30 bg-black">
                    <img src="/brand.svg" alt="Cleanup Tracker" className="w-10 h-10 rounded-2xl hidden sm:block" onError={(e)=>{e.currentTarget.style.display='none';}}/>
                    <div className="sm:hidden flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7.5c-1.2-2.1-3.4-3.5-6-3.5-3.9 0-7 3.1-7 7s3.1 7 7 7c2.6 0 4.8-1.4 6-3.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7v10" />
                      </svg>
                    </div>
                  </div>
                  <div className="leading-tight">
                    <span className="text-sm font-semibold text-white">
                      {corporateMark.lead}
                      {corporateMark.tail && <span className="text-gray-400"> {corporateMark.tail}</span>}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:block h-8 w-px bg-gray-800" />
                <div className="leading-tight">
                  <span className="text-[9px] uppercase tracking-[0.28em] text-gray-500">Current View</span>
                  <h2 className="text-lg font-semibold text-white">{viewTitle}</h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black/40 px-3 py-1 text-[11px] uppercase tracking-wide text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {user.role}
                </span>
                <div className="text-xs text-gray-500 font-mono hidden sm:block">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>

          {/* Content Container - reduced padding for more space */}
          <div className="p-3 sm:p-4">
          {/* Detailer Views */}
          {(user.role === 'detailer' || user.role === 'technician') && (
            <>
              {view === 'dashboard' && (
                <DetailerDashboard
                  user={user}
                  jobs={activeJobs}
                  completedJobs={completedJobs}
                  userActiveJob={userActiveJob}
                  onStopWork={handleStopWork}
                  onRefresh={loadInitialData}
                  onOpenScanner={() => setShowScanner(true)}
                  onGoToNewJob={() => { setView('jobs'); closeSidebar(); }}
                />
              )}
              {view === 'jobs' && (
                <DetailerNewJob
                  user={user}
                  onSearch={handleSearch}
                  searchResults={searchResults}
                  isSearching={isSearching}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  showScanner={showScanner}
                  setShowScanner={setShowScanner}
                  onScanSuccess={handleScanSuccess}
                  hasSearched={hasSearched}
                  serviceTypesCatalog={serviceCatalog}
                  onJobCreated={async () => {
                    await loadInitialData();
                    setView('dashboard');
                    closeSidebar();
                  }}
                />
              )}
              {view === 'me' && <MySettingsView user={user} />}
            </>
          )}

          {/* Manager Views */}
          {user.role === 'manager' && (
            <>
              {view === 'dashboard' && <ManagerDashboard jobs={jobs} users={users} currentUser={user} onRefresh={loadInitialData} dashboardStats={dashboardStats} />}
              {view === 'jobs' && <JobsView jobs={jobs} users={users} currentUser={user} onRefresh={loadInitialData} />}
              {view === 'qc' && <QCView jobs={jobs} users={users} currentUser={user} onRefresh={loadInitialData} />}
              {view === 'users' && <UsersView users={users} detailers={detailers} onDeleteUser={deleteUser} onRefresh={loadInitialData} />}
              {view === 'reports' && <ReportsView jobs={jobs} users={users} />}
              {view === 'inventory' && (
                <EnterpriseInventory
                  theme={theme}
                  currentUser={user}
                  serviceTypes={serviceCatalog}
                  onVehicleUpdated={(updatedVehicle) => {
                    if (!updatedVehicle) return;
                    loadInitialData();
                  }}
                  onCreateJob={async (vehicle) => {
                    if (!vehicle) return;
                    try {
                      const serviceTypeName = defaultServiceType?.name || 'Cleanup';
                      const expectedDuration = defaultServiceType?.expectedMinutes || 60;
                      await V2.post('/jobs', {
                        technicianId: user.id,
                        technicianName: user.name,
                        vin: vehicle.vin,
                        stockNumber: vehicle.stockNumber,
                        vehicleDescription: `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.vehicle || 'Vehicle',
                        serviceType: serviceTypeName,
                        expectedDuration,
                        year: vehicle.year,
                        make: vehicle.make,
                        model: vehicle.model,
                        vehicleColor: vehicle.color || ''
                      });
                      await loadInitialData();
                      toast.success('Job created successfully');
                    } catch (error) {
                      const message = error?.response?.data?.error || error?.message || 'Failed to create job';
                      toast.error(message);
                      throw error;
                    }
                  }}
                />
              )}
              {view === 'settings' && <SettingsView settings={settings} onSettingsChange={setSettings} />}
              {view === 'me' && <MySettingsView user={user} />}
            </>
          )}

          {/* Salesperson Views */}
          {user.role === 'salesperson' && (
            <>
              {view === 'dashboard' && <SalespersonDashboard user={user} jobs={jobs} onRefresh={loadInitialData} />}
              {view === 'me' && <MySettingsView user={user} />}
            </>
          )}
        </div>
        </div>
      </div>

      {/* 🚀 Enterprise Command Palette */}
      {showCommandPalette && (
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onSelect={(action) => {
            setShowCommandPalette(false);
            closeSidebar();
            if (action.view) setView(action.view);
            if (action.handler) action.handler();
          }}
          items={[
            { id: 'dashboard', label: 'Go to Dashboard', view: 'dashboard', icon: '🏠' },
            { id: 'jobs', label: 'View Jobs', view: 'jobs', icon: '📋' },
            { id: 'reports', label: 'View Reports', view: 'reports', icon: '📊' },
            { id: 'users', label: 'Manage Users', view: 'users', icon: '👥' },
            { id: 'settings', label: 'Settings', view: 'settings', icon: '⚙️' },
            { id: 'scanner', label: 'Open VIN Scanner', handler: () => setShowScanner(true), icon: '📱' },
            { id: 'refresh', label: 'Refresh Data', handler: loadInitialData, icon: '🔄' },
            { id: 'logout', label: 'Sign Out', handler: onLogout, icon: '🚪', destructive: true }
          ].filter(item => {
            // Filter based on user role
            if (user.role === 'detailer' && ['users', 'reports'].includes(item.id)) return false;
            if (user.role === 'salesperson' && ['users', 'jobs', 'reports'].includes(item.id)) return false;
            return true;
          })}
        />
      )}
    </>
  );
}

// Enhanced Enterprise Detailer Dashboard Component
// Main Component - Enhanced with professional error handling
export default function FirebaseV2() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const handleLogin = useCallback((sessionData) => {
    if (!sessionData?.user || !sessionData?.tokens) {
      Logger.error('Invalid session payload received on login', null, { sessionData });
      setError('Login failed: unexpected response');
      return;
    }

    setSessionTokens(sessionData.tokens);
    persistSession(sessionData);
    Logger.info('User login successful', { 
      userId: sessionData.user?.id, 
      role: sessionData.user?.role,
      name: sessionData.user?.name 
    });
    setUser(sessionData.user);
    setError(null);
  }, []);

  const handleLogout = useCallback((message) => {
    Logger.info('User logout');
    clearSessionTokens();
    persistSession(null);
    setUser(null);
    setError(message || null);
  }, []);

  const handleError = useCallback((errorMessage, error = null) => {
    Logger.error('Application error', error, { errorMessage });
    setError(errorMessage);
  }, []);

  useEffect(() => {
    const stored = loadStoredSession();
    if (stored?.user && stored?.tokens) {
      setSessionTokens(stored.tokens);
      setUser(stored.user);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onUnauthorized = () => {
      handleLogout('Your session expired. Please sign in again.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [handleLogout]);

  // 🚀 Command Palette Keyboard Shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show error with professional styling
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="bg-black rounded-xl p-6 border border-red-200 shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-red-800 font-bold mb-2">Application Error</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <button 
                onClick={() => setError(null)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main app render
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      {!user ? (
        <LoginForm onLogin={handleLogin} />
        ) : (
          <MainApp 
            user={user} 
            onLogout={handleLogout} 
            onError={handleError}
            showCommandPalette={showCommandPalette}
            setShowCommandPalette={setShowCommandPalette}
          />
        )}
    </Suspense>
  );
}
