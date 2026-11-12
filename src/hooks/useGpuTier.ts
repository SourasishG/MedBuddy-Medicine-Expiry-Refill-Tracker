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
    let timeoutHandle: number | undefined;

    const isMobile = window.matchMedia('(max-width: 959px)').matches;
    const webgl = hasWebGLInterface();
    const override = readTierOverride();

    if (!motionEnabled || !webgl) {
      queueMicrotask(() => {
        if (!cancelled) {
          setProfile({
            tier: 'low',
            isMobile,
            isWebGLAvailable: webgl,
            ready: true,
          });
        }
      });
      return () => {
        cancelled = true;
      };
    }

    if (override) {
      queueMicrotask(() => {
        if (!cancelled) {
          setProfile({
            tier: override,
            isMobile,
            isWebGLAvailable: true,
            ready: true,
          });
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const detectTier = () => {
      if (cancelled) return;
      import('detect-gpu')
        .then(({ getGPUTier }) => getGPUTier())
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
            isMobile,
            isWebGLAvailable: true,
            ready: true,
          });
        })
        .catch(() => {
          if (cancelled) return;
          setProfile({
            tier: isMobile ? 'medium' : 'high',
            isMobile,
            isWebGLAvailable: true,
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
