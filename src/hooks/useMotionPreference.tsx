'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'medbuddy-motion';

interface MotionContextValue {
  motionEnabled: boolean;
  isHydrated: boolean;
  toggleMotion: () => void;
  setMotionEnabled: (enabled: boolean) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

function readStoredPreference(): boolean | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    // localStorage unavailable (private browsing / restricted storage)
  }
  return null;
}

function writeStoredPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Ignore storage write failures
  }
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [motionEnabled, setMotionEnabledState] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  useEffect(() => {
    const stored = readStoredPreference();
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const initial = stored !== null ? stored : !mediaQuery.matches;

    setMotionEnabledState(initial);
    document.documentElement.dataset.motion = initial ? 'on' : 'off';
    setIsHydrated(true);

    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (readStoredPreference() === null) {
        const next = !event.matches;
        setMotionEnabledState(next);
        document.documentElement.dataset.motion = next ? 'on' : 'off';
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const setMotionEnabled = useCallback((enabled: boolean) => {
    setMotionEnabledState(enabled);
    writeStoredPreference(enabled);
    document.documentElement.dataset.motion = enabled ? 'on' : 'off';
  }, []);

  const toggleMotion = useCallback(() => {
    setMotionEnabledState((prev) => {
      const next = !prev;
      writeStoredPreference(next);
      document.documentElement.dataset.motion = next ? 'on' : 'off';
      return next;
    });
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
