'use client';

import { useEffect, useRef, useState } from 'react';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import styles from './Cursor.module.scss';

export function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const { motionEnabled, isHydrated } = useMotionPreference();
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isHydrated || !motionEnabled) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!finePointer.matches) return;

    let cancelled = false;
    let cleanupListeners: (() => void) | undefined;

    void import('@/lib/gsap').then(({ ensureGsapRegistered, gsap }) => {
      if (cancelled) return;
      ensureGsapRegistered();
      const ring = ringRef.current;
      if (!ring) return;

      const xTo = gsap.quickTo(ring, 'x', { duration: 0.32, ease: 'power3.out' });
      const yTo = gsap.quickTo(ring, 'y', { duration: 0.32, ease: 'power3.out' });

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        setIsVisible(true);
        xTo(event.clientX);
        yTo(event.clientY);

        const target = event.target as HTMLElement | null;
        const interactive = Boolean(
          target?.closest('a, button, [role="button"], input, summary, [data-cursor="interactive"]'),
        );
        setIsActive(interactive);
      };

      const onPointerLeave = () => {
        setIsVisible(false);
      };

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('mouseleave', onPointerLeave);

      cleanupListeners = () => {
        window.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('mouseleave', onPointerLeave);
      };
    });

    return () => {
      cancelled = true;
      cleanupListeners?.();
    };
  }, [isHydrated, motionEnabled]);

  if (!isHydrated || !motionEnabled) return null;

  return (
    <div
      ref={ringRef}
      className={styles.ring}
      data-visible={isVisible}
      data-active={isActive}
      aria-hidden="true"
    />
  );
}
