'use client';

import { useEffect, type ReactNode } from 'react';
import { LazyMotion } from 'framer-motion';
import { useMotionPreference } from '@/hooks/useMotionPreference';

const loadMotionFeatures = () => import('framer-motion').then((mod) => mod.domMax);

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const { motionEnabled, isHydrated } = useMotionPreference();

  useEffect(() => {
    if (!isHydrated) return;

    let cancelled = false;
    let destroyController: (() => void) | undefined;

    if (!motionEnabled) {
      import('@/lib/gsap').then(({ loadGsapPlugins }) => {
        if (cancelled) return;
        void loadGsapPlugins().then(({ ScrollTrigger }) => {
          if (!cancelled) ScrollTrigger.refresh();
        });
      });
      return () => {
        cancelled = true;
      };
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

    return () => {
      cancelled = true;
      destroyController?.();
    };
  }, [motionEnabled, isHydrated]);

  return <LazyMotion features={loadMotionFeatures}>{children}</LazyMotion>;
}
