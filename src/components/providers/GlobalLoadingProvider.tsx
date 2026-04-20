'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

interface LoadingEntry {
  id: number;
  message: string;
}

interface GlobalLoadingContextValue {
  showLoading: (message?: string) => number;
  hideLoading: (id: number) => void;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export const GlobalLoadingProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const nextIdRef = useRef(1);
  const [entries, setEntries] = useState<LoadingEntry[]>([]);

  const showLoading = useCallback((message = '正在加载...') => {
    const id = nextIdRef.current++;
    setEntries((prev) => [...prev, { id, message }]);
    return id;
  }, []);

  const hideLoading = useCallback((id: number) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const contextValue = useMemo<GlobalLoadingContextValue>(
    () => ({
      showLoading,
      hideLoading,
    }),
    [hideLoading, showLoading],
  );

  const activeEntry = entries[entries.length - 1] ?? null;

  return (
    <GlobalLoadingContext.Provider value={contextValue}>
      {children}
      <Backdrop
        open={Boolean(activeEntry)}
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 2000,
          backgroundColor: 'rgba(245, 247, 250, 0.72)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Box
          sx={{
            minWidth: 220,
            px: 3,
            py: 2.5,
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            backgroundColor: 'rgba(17, 24, 39, 0.82)',
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.24)',
          }}
        >
          <CircularProgress size={34} thickness={4} sx={{ color: '#fff' }} />
          <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>
            {activeEntry?.message ?? '正在加载...'}
          </Typography>
        </Box>
      </Backdrop>
    </GlobalLoadingContext.Provider>
  );
};

export const useGlobalLoading = (): GlobalLoadingContextValue => {
  const context = useContext(GlobalLoadingContext);

  if (!context) {
    throw new Error('useGlobalLoading must be used within GlobalLoadingProvider');
  }

  return context;
};