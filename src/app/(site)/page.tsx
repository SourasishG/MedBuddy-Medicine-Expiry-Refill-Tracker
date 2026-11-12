'use client';

import { useEffect, useRef, useState } from 'react';
import { MotionToggle } from '@/components/ui/MotionToggle';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { ensureGsapRegistered, ScrollTrigger } from '@/lib/gsap';
import styles from './page.module.scss';

export default function PhaseZeroPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { motionEnabled } = useMotionPreference();

  useEffect(() => {
    ensureGsapRegistered();

    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        setScrollProgress(Math.round(self.progress * 100));
      },
    });

    return () => {
      trigger.kill();
    };
  }, [motionEnabled]);

  return (
    <div ref={containerRef} className={styles.stage}>
      <header className={styles.header}>
        <span className={styles.brand}>MEDBUDDY</span>
        <div className={styles.controls}>
          <span className={styles.scrollReadout} aria-hidden="true">
            SCROLL {String(scrollProgress).padStart(3, '0')}%
          </span>
          <MotionToggle />
        </div>
      </header>

      <main id="main-content" className={styles.main}>
        <section className={styles.band} aria-label="Foundation verification">
          <p className={styles.mono}>PHASE 00 / FOUNDATION</p>
          <h1 className={styles.title}>
            Every dose. Every expiry. Every <em>loved one.</em>
          </h1>
          <p className={styles.subtitle}>
            Base layout, typography, SCSS design tokens, Motion preference toggle, and Lenis +
            ScrollTrigger scroll wiring are active.
          </p>
        </section>

        <section className={styles.band} aria-label="Scroll calibration">
          <p className={styles.mono}>SCROLL CHECKPOINT / 01</p>
          <p className={styles.note}>
            Smooth scroll runs via Lenis synchronized to GSAP ScrollTrigger when Motion is On, and
            reverts to standard native scroll when Motion is Off.
          </p>
        </section>

        <section className={styles.band} aria-label="End of scroll stage">
          <p className={styles.mono}>SCROLL CHECKPOINT / 02</p>
          <p className={styles.note}>End of Phase 0 scroll stage.</p>
        </section>
      </main>
    </div>
  );
}
