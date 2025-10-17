import React, { useState, useEffect } from 'react';
import { DateUtils } from '../utils/dateUtils';

/**
 * Enterprise-grade Live Timer with X-style design
 * Features: smooth animations, color transitions, glow effects
 */
export default function LiveTimer({
  startTime,
  className = "text-lg font-mono",
  showIcon = true,
  compact = false,
  glowColor = "blue" // blue, green, yellow, red
}) {
  const [elapsed, setElapsed] = useState(0);
  const [isValid, setIsValid] = useState(true);
  const [pulse, setPulse] = useState(false);

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

      // Pulse effect every minute
      if (diff % 60 === 0) {
        setPulse(true);
        setTimeout(() => setPulse(false), 300);
      }
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

  const getGlowClass = () => {
    switch(glowColor) {
      case 'green': return 'shadow-glow-green';
      case 'purple': return 'shadow-glow-purple';
      case 'blue':
      default: return 'shadow-glow-blue';
    }
  };

  const getTextColorClass = () => {
    const hours = Math.floor(elapsed / 3600);
    if (hours >= 3) return 'text-x-red'; // Over 3 hours
    if (hours >= 2) return 'text-x-yellow'; // Over 2 hours
    return 'text-x-green'; // Under 2 hours
  };

  if (!isValid) {
    return (
      <span className={`${className} text-x-text-secondary`}>
        {showIcon && <span className="inline-block mr-2">⏱</span>}
        --:--:--
      </span>
    );
  }

  if (compact) {
    return (
      <span className={`${className} ${getTextColorClass()} transition-all duration-300 ${pulse ? 'scale-110' : 'scale-100'}`}>
        {formatTime(elapsed)}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-x-bg-secondary border border-x-border ${getGlowClass()} transition-all duration-300 ${pulse ? 'scale-105' : 'scale-100'}`}>
      {showIcon && (
        <div className="relative">
          <svg className={`w-5 h-5 ${getTextColorClass()} animate-spin-slow`} style={{animationDuration: '3s'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className={`absolute -top-1 -right-1 w-2 h-2 ${getTextColorClass()} rounded-full animate-pulse`}></div>
        </div>
      )}
      <span className={`${className} ${getTextColorClass()} font-bold tracking-wide`}>
        {formatTime(elapsed)}
      </span>
    </div>
  );
}
