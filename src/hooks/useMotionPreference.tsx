'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useIsHydrated } from './useIsHydrated';

interface MotionContextValue {
  motionEnabled: boolean;
  isHydrated: boolean;
}

const MotionContext = createContext<MotionContextValue | null>(null);

function getMotionSnapshot(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getMotionServerSnapshot(): boolean {
  return true;
}

function subscribeMotion(callback: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const motionEnabled = useSyncExternalStore(
    subscribeMotion,
    getMotionSnapshot,
    getMotionServerSnapshot,
  );
  const isHydrated = useIsHydrated();

  useEffect(() => {
    document.documentElement.dataset.motion = motionEnabled ? 'on' : 'off';
  }, [motionEnabled]);

  const value = useMemo(
    () => ({
      motionEnabled,
      isHydrated,
    }),
    [motionEnabled, isHydrated],
  );

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotionPreference(): MotionContextValue {
  const context = useContext(MotionContext);
  if (!context) {
    throw new Error('useMotionPreference must be used within a MotionProvider');
  }
  return context;
}
