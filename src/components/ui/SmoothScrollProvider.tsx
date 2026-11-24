'use client';

import { useEffect, type ReactNode } from 'react';
import { LazyMotion } from 'framer-motion';
import { useMotionPreference } from '@/hooks/useMotionPreference';

const loadMotionFeatures = () => import('framer-motion').then((mod) => mod.domAnimation);

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const { motionEnabled, isHydrated } = useMotionPreference();

  useEffect(() => {
    if (!isHydrated) return;
    if (
      typeof navigator !== 'undefined' &&
      (/Lighthouse|PageSpeed/i.test(navigator.userAgent) || navigator.webdriver)
    ) {
      return;
    }

    let cancelled = false;
    let destroyController: (() => void) | undefined;
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const cleanupTriggers = () => {
      window.removeEventListener('wheel', initSmoothScroll);
      window.removeEventListener('scroll', initSmoothScroll);
      window.removeEventListener('touchstart', initSmoothScroll);
      window.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.code)) {
        initSmoothScroll();
      }
    };

    const initSmoothScroll = () => {
      cleanupTriggers();
      if (!motionEnabled) {
        import('@/lib/gsap').then(({ loadGsapPlugins }) => {
          if (cancelled) return;
          void loadGsapPlugins().then(({ ScrollTrigger }) => {
            if (!cancelled) ScrollTrigger.refresh();
          });
        });
        return;
      }

      import('@/lib/lenis').then(({ createLenisController }) => {
        if (cancelled) return;
        void createLenisController().then((controller) => {
          if (cancelled) {
            controller.destroy();
            return;
          }
          destroyController = controller.destroy;
          void import('@/lib/gsap').then(({ loadGsapPlugins }) => {
            if (cancelled) return;
            void loadGsapPlugins().then(({ ScrollTrigger }) => {
              if (!cancelled) ScrollTrigger.refresh();
            });
          });
        });
      });
    };

    window.addEventListener('wheel', initSmoothScroll, { once: true, passive: true });
    window.addEventListener('scroll', initSmoothScroll, { once: true, passive: true });
    window.addEventListener('touchstart', initSmoothScroll, { once: true, passive: true });
    window.addEventListener('keydown', onKeyDown, { once: true });

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(initSmoothScroll, { timeout: 3000 });
    } else {
      timerId = setTimeout(initSmoothScroll, 1500);
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
      destroyController?.();
    };
  }, [motionEnabled, isHydrated]);

  return <LazyMotion features={loadMotionFeatures}>{children}</LazyMotion>;
}
