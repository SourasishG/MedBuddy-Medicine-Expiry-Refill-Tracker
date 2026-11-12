'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useGpuTier } from '@/hooks/useGpuTier';
import { useMotionPreference } from '@/hooks/useMotionPreference';

const DynamicScene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => null,
});

export interface SceneLoaderProps {
  onSceneReadyChange?: (active: boolean) => void;
}

export function SceneLoader({ onSceneReadyChange }: SceneLoaderProps) {
  const { tier, isMobile, isWebGLAvailable, ready } = useGpuTier();
  const { motionEnabled } = useMotionPreference();
  const [afterPaint, setAfterPaint] = useState(false);
  const [contextFailed, setContextFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const raf = window.requestAnimationFrame(() => {
      if (!cancelled) {
        setAfterPaint(true);
      }
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, []);

  const shouldRenderCanvas =
    afterPaint && ready && motionEnabled && isWebGLAvailable && tier !== 'low' && !contextFailed;

  useEffect(() => {
    if (!shouldRenderCanvas) {
      onSceneReadyChange?.(false);
    }
  }, [shouldRenderCanvas, onSceneReadyChange]);

  if (!shouldRenderCanvas) return null;

  return (
    <DynamicScene
      initialTier={tier === 'high' ? 'high' : 'medium'}
      isMobile={isMobile}
      onReady={() => onSceneReadyChange?.(true)}
      onFallbackToPoster={() => {
        setContextFailed(true);
        onSceneReadyChange?.(false);
      }}
    />
  );
}
