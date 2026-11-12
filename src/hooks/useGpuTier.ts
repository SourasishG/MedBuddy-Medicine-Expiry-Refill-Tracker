'use client';

import { useEffect, useState } from 'react';
import { useMotionPreference } from './useMotionPreference';

export type QualityTier = 'high' | 'medium' | 'low';

export interface GpuProfile {
  tier: QualityTier;
  isMobile: boolean;
  isWebGLAvailable: boolean;
  ready: boolean;
}

function hasWebGLInterface(): boolean {
  if (typeof window === 'undefined') return false;
  return 'WebGLRenderingContext' in window || 'WebGL2RenderingContext' in window;
}

function canCreateWebGLContext(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function readTierOverride(): QualityTier | null {
  if (typeof window === 'undefined') return null;
  try {
    const param = new URLSearchParams(window.location.search).get('tier');
    if (param === 'high' || param === 'medium' || param === 'low') {
      return param;
    }
  } catch {
    // Ignore URL parsing errors
  }
  return null;
}

export function useGpuTier(): GpuProfile {
  const { motionEnabled, isHydrated } = useMotionPreference();
  const [profile, setProfile] = useState<GpuProfile>({
    tier: 'low',
    isMobile: false,
    isWebGLAvailable: true,
    ready: false,
  });

  useEffect(() => {
    if (!isHydrated) return;

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const mediaQuery = window.matchMedia('(max-width: 959px)');
    const isMobile = mediaQuery.matches;
    const webgl = hasWebGLInterface();
    const override = readTierOverride();

    const onMediaChange = () => {
      if (cancelled) return;
      setProfile((prev) =>
        prev.isMobile === mediaQuery.matches ? prev : { ...prev, isMobile: mediaQuery.matches },
      );
    };
    mediaQuery.addEventListener('change', onMediaChange);

    if (!motionEnabled || !webgl) {
      queueMicrotask(() => {
        if (!cancelled) {
          setProfile({
            tier: 'low',
            isMobile: mediaQuery.matches,
            isWebGLAvailable: webgl,
            ready: true,
          });
        }
      });
      return () => {
        cancelled = true;
        mediaQuery.removeEventListener('change', onMediaChange);
      };
    }

    if (override) {
      queueMicrotask(() => {
        if (!cancelled) {
          setProfile({
            tier: override,
            isMobile: mediaQuery.matches,
            isWebGLAvailable: true,
            ready: true,
          });
        }
      });
      return () => {
        cancelled = true;
        mediaQuery.removeEventListener('change', onMediaChange);
      };
    }

    const detectTier = () => {
      if (cancelled) return;
      import('detect-gpu')
        .then(({ getGPUTier }) => getGPUTier({ benchmarksURL: '/benchmarks' }))
        .then((result) => {
          if (cancelled) return;
          let mapped: QualityTier = 'medium';
          if (result.tier >= 3) {
            mapped = 'high';
          } else if (result.tier <= 1 || result.type === 'FALLBACK') {
            mapped = 'low';
          }
          setProfile({
            tier: mapped,
            isMobile: mediaQuery.matches,
            isWebGLAvailable: true,
            ready: true,
          });
        })
        .catch(() => {
          if (cancelled) return;
          const contextOk = canCreateWebGLContext();
          setProfile({
            tier: contextOk ? (mediaQuery.matches ? 'medium' : 'high') : 'low',
            isMobile: mediaQuery.matches,
            isWebGLAvailable: contextOk,
            ready: true,
          });
        });
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(detectTier, { timeout: 600 });
    } else {
      timeoutHandle = setTimeout(detectTier, 120);
    }

    return () => {
      cancelled = true;
      mediaQuery.removeEventListener('change', onMediaChange);
      if (idleHandle !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    };
  }, [isHydrated, motionEnabled]);

  return profile;
}
