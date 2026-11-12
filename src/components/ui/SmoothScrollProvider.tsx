'use client';

import { useEffect, type ReactNode } from 'react';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { createLenisController } from '@/lib/lenis';
import { ensureGsapRegistered, ScrollTrigger } from '@/lib/gsap';

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const { motionEnabled, isHydrated } = useMotionPreference();

  useEffect(() => {
    if (!isHydrated) return;

    ensureGsapRegistered();

    if (!motionEnabled) {
      ScrollTrigger.refresh();
      return;
    }

    const controller = createLenisController();
    ScrollTrigger.refresh();

    return () => {
      controller.destroy();
    };
  }, [motionEnabled, isHydrated]);

  return <>{children}</>;
}
