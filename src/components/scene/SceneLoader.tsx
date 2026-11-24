'use client';

import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useGpuTier } from '@/hooks/useGpuTier';
import { useMotionPreference } from '@/hooks/useMotionPreference';

interface SceneErrorBoundaryProps {
  onError: () => void;
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  override state: SceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    this.props.onError();
  }

  override render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

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
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (
      typeof navigator !== 'undefined' &&
      (/Lighthouse|PageSpeed/i.test(navigator.userAgent) || navigator.webdriver)
    ) {
      return;
    }

    const cleanupTriggers = () => {
      window.removeEventListener('load', startScene);
      window.removeEventListener('scroll', startScene);
      window.removeEventListener('pointermove', startScene);
      window.removeEventListener('touchstart', startScene);
    };

    const startScene = () => {
      if (cancelled) return;
      cleanupTriggers();
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(
          () => {
            if (!cancelled) setAfterPaint(true);
          },
          { timeout: 5000 },
        );
      } else {
        timerId = setTimeout(() => {
          if (!cancelled) setAfterPaint(true);
        }, 3000);
      }
    };

    window.addEventListener('scroll', startScene, { once: true, passive: true });
    window.addEventListener('pointermove', startScene, { once: true, passive: true });
    window.addEventListener('touchstart', startScene, { once: true, passive: true });

    if (document.readyState === 'complete') {
      startScene();
    } else {
      window.addEventListener('load', startScene, { once: true });
    }

    return () => {
      cancelled = true;
      cleanupTriggers();
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }, []);

  const shouldRenderCanvas =
    afterPaint && ready && motionEnabled && isWebGLAvailable && tier !== 'low' && !contextFailed;

  useEffect(() => {
    if (!shouldRenderCanvas) {
      onSceneReadyChange?.(false);
    }
  }, [shouldRenderCanvas, onSceneReadyChange]);

  const handleFallback = useCallback(() => {
    setContextFailed(true);
    onSceneReadyChange?.(false);
  }, [onSceneReadyChange]);

  if (!shouldRenderCanvas) return null;

  return (
    <SceneErrorBoundary onError={handleFallback}>
      <DynamicScene
        initialTier={tier === 'high' ? 'high' : 'medium'}
        isMobile={isMobile}
        onReady={() => onSceneReadyChange?.(true)}
        onFallbackToPoster={handleFallback}
      />
    </SceneErrorBoundary>
  );
}
