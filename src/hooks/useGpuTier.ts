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

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return Boolean(gl);
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
    const isMobile = window.matchMedia('(max-width: 959px)').matches;
    const webgl = checkWebGLSupport();
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

    import('detect-gpu')
      .then(({ getGPUTier }) => getGPUTier())
      .then((result) => {
        if (cancelled) return;
        let mapped: QualityTier = 'medium';
        if (result.tier >= 3) {
          mapped = 'high';
        } else if (result.tier <= 1) {
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

    return () => {
      cancelled = true;
    };
  }, [isHydrated, motionEnabled]);

  return profile;
}
