'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useIsHydrated } from './useIsHydrated';

const STORAGE_KEY = 'medbuddy-motion';
const MOTION_EVENT = 'medbuddy-motion-change';

export interface MotionContextValue {
  motionEnabled: boolean;
  isHydrated: boolean;
  toggleMotion: () => void;
  setMotionEnabled: (enabled: boolean) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

function readStoredPreference(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    // localStorage unavailable (e.g. private browsing or restricted permissions)
  }
  return null;
}

function writeStoredPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Ignore storage write failures
  }
}

function getMotionSnapshot(): boolean {
  const stored = readStoredPreference();
  if (stored !== null) return stored;
  if (typeof window === 'undefined') return true;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getMotionServerSnapshot(): boolean {
  return true;
}

function subscribeMotion(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMediaChange = () => {
    if (readStoredPreference() === null) {
      callback();
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      callback();
    }
  };

  mediaQuery.addEventListener('change', onMediaChange);
  window.addEventListener('storage', onStorage);
  window.addEventListener(MOTION_EVENT, callback);

  return () => {
    mediaQuery.removeEventListener('change', onMediaChange);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(MOTION_EVENT, callback);
  };
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

  const setMotionEnabled = useCallback((enabled: boolean) => {
    writeStoredPreference(enabled);
    document.documentElement.dataset.motion = enabled ? 'on' : 'off';
    window.dispatchEvent(new Event(MOTION_EVENT));
  }, []);

  const toggleMotion = useCallback(() => {
    const next = !getMotionSnapshot();
    writeStoredPreference(next);
    document.documentElement.dataset.motion = next ? 'on' : 'off';
    window.dispatchEvent(new Event(MOTION_EVENT));
  }, []);

  const value = useMemo(
    () => ({
      motionEnabled,
      isHydrated,
      toggleMotion,
      setMotionEnabled,
    }),
    [motionEnabled, isHydrated, toggleMotion, setMotionEnabled],
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
