/**
 * Utility functions for date/time handling with Eastern Time support
 */
export const DateUtils = {
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

export default DateUtils;
