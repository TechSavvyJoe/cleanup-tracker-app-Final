import React, { createContext, useContext, useMemo } from 'react';

const SessionContext = createContext(null);

export function SessionProvider({ value, children }) {
  const memoizedValue = useMemo(() => value, [value]);
  return <SessionContext.Provider value={memoizedValue}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
