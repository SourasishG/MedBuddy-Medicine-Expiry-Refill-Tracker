'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { ensureGsapRegistered, gsap } from '@/lib/gsap';
import styles from './Preloader.module.scss';

const SESSION_KEY = 'medbuddy-preloader-seen';
const PILL_COUNT = 12;

const emptySubscribe = () => () => {};

function readFirstVisit(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

function markVisited(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Ignore sessionStorage restrictions
  }
}

export function Preloader() {
  const { motionEnabled, isHydrated } = useMotionPreference();
  const isFirstVisit = useSyncExternalStore(emptySubscribe, readFirstVisit, () => false);
  const [dismissed, setDismissed] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const scanlineRef = useRef<HTMLDivElement>(null);

  const active = isHydrated && motionEnabled && isFirstVisit && !dismissed;

  useEffect(() => {
    if (!active) return;

    ensureGsapRegistered();
    markVisited();

    const root = rootRef.current;
    const counterEl = counterRef.current;
    const wordmarkEl = wordmarkRef.current;
    const scanlineEl = scanlineRef.current;
    if (!root || !counterEl || !wordmarkEl || !scanlineEl) return;

    const pills = root.querySelectorAll('[data-preloader-pill]');
    const state = { value: 0 };

    const tl = gsap.timeline({
      onComplete: () => {
        setDismissed(true);
      },
    });

    tl.fromTo(
      pills,
      {
        opacity: 0,
        scale: 0.4,
        y: (i: number) => (i % 2 === 0 ? -24 : 24),
      },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.65,
        stagger: 0.035,
        ease: 'power3.out',
      },
      0,
    )
      .to(
        state,
        {
          value: 100,
          duration: 1.05,
          ease: 'power2.out',
          onUpdate: () => {
            counterEl.textContent = String(Math.round(state.value)).padStart(3, '0');
          },
        },
        0,
      )
      .fromTo(
        wordmarkEl,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' },
        0.95,
      )
      .fromTo(
        scanlineEl,
        { opacity: 0, yPercent: -100 },
        { opacity: 0.7, yPercent: 120, duration: 0.24, ease: 'none' },
        1.05,
      )
      .to(
        root,
        {
          opacity: 0,
          duration: 0.35,
          ease: 'power3.out',
        },
        1.4,
      );

    return () => {
      tl.kill();
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className={styles.preloader}
      role="status"
      aria-live="polite"
      aria-label="Loading MedBuddy"
    >
      <div className={styles.inner}>
        <span className={styles.sectionCode}>00 / SPECIMEN INIT</span>

        <div className={styles.ringWrap} aria-hidden="true">
          <div className={styles.ring} />
          {Array.from({ length: PILL_COUNT }).map((_, index) => {
            const angle = (index / PILL_COUNT) * 360;
            return (
              <span
                key={index}
                className={styles.pillOrbit}
                style={{
                  transform: `rotate(${angle}deg) translateY(-58px)`,
                }}
              >
                <span data-preloader-pill className={styles.pill} />
              </span>
            );
          })}
          <span ref={counterRef} className={styles.counter}>
            000
          </span>
        </div>

        <span ref={wordmarkRef} className={styles.wordmark}>
          MEDBUDDY
        </span>
      </div>

      <div ref={scanlineRef} className={styles.scanline} aria-hidden="true" />

      <button
        type="button"
        className={styles.skip}
        onClick={() => {
          markVisited();
          setDismissed(true);
        }}
      >
        Skip intro
      </button>
    </div>
  );
}
