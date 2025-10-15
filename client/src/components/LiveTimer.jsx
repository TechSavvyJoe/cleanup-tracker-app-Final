import React, { useState, useEffect } from 'react';
import { DateUtils } from '../utils/dateUtils';

/**
 * Enhanced Live Timer Component with error handling
 * Displays elapsed time since a start time
 */
export default function LiveTimer({ startTime, className = "text-lg font-mono" }) {
  const [elapsed, setElapsed] = useState(0);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    if (!startTime || !DateUtils.isValidDate(startTime)) {
      setIsValid(false);
      setElapsed(0);
      return;
    }

    setIsValid(true);
    const start = new Date(startTime).getTime();
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - start) / 1000));
      // Cap at 24 hours to prevent display issues
      setElapsed(Math.min(diff, 24 * 60 * 60));
    };

    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds) => {
    if (!isValid || seconds === 0) return '--:--:--';
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  if (!isValid) {
    return <span className={className}>--:--:--</span>;
  }

  return <span className={className}>{formatTime(elapsed)}</span>;
}
