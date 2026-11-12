'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { GlassCard } from '@/components/ui/GlassCard';
import { PillButton } from '@/components/ui/PillButton';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { ensureGsapRegistered, gsap, SplitText } from '@/lib/gsap';
import styles from './Hero.module.scss';

export interface HeroProps {
  hasCanvas?: boolean;
  onInstallClick?: () => void;
}

export function Hero({ hasCanvas = false, onInstallClick }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const posterWrapRef = useRef<HTMLDivElement>(null);
  const { motionEnabled, isHydrated } = useMotionPreference();

  useEffect(() => {
    if (!isHydrated || !motionEnabled) return;

    ensureGsapRegistered();
    const headline = headlineRef.current;
    if (!headline) return;

    const split = SplitText.create(headline, {
      type: 'lines',
      mask: 'lines',
    });

    const tween = gsap.from(split.lines, {
      yPercent: 105,
      opacity: 0,
      duration: 1.05,
      stagger: 0.06,
      ease: 'power3.out',
      clearProps: 'transform,opacity',
    });

    return () => {
      tween.kill();
      split.revert();
    };
  }, [isHydrated, motionEnabled]);

  useEffect(() => {
    if (!isHydrated || !motionEnabled || hasCanvas) return;

    const section = sectionRef.current;
    const poster = posterWrapRef.current;
    if (!section || !poster) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!finePointer.matches) return;

    ensureGsapRegistered();
    const xTo = gsap.quickTo(poster, 'x', { duration: 1.1, ease: 'power3.out' });
    const yTo = gsap.quickTo(poster, 'y', { duration: 1.1, ease: 'power3.out' });

    const onMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      xTo(nx * -18);
      yTo(ny * -14);
    };

    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    section.addEventListener('pointermove', onMove, { passive: true });
    section.addEventListener('pointerleave', onLeave);

    return () => {
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
      gsap.set(poster, { x: 0, y: 0 });
    };
  }, [hasCanvas, isHydrated, motionEnabled]);

  return (
    <section id="hero" ref={sectionRef} className={styles.hero} aria-labelledby="hero-heading">
      {/* Five vertical hairline columns across the stage */}
      <div className={styles.columns} aria-hidden="true">
        <span className={styles.column} />
        <span className={styles.column} />
        <span className={styles.column} />
        <span className={styles.column} />
        <span className={styles.column} />
      </div>

      {/* Ambient deep blue gallery halo */}
      <div className={styles.ambientGlow} aria-hidden="true" />

      <div className={styles.grid}>
        {/* Headline: above phone on mobile, overlapping lower phone/helix on desktop */}
        <div className={styles.headlineBlock}>
          <h1 id="hero-heading" ref={headlineRef} className={styles.headline}>
            Every dose. Every expiry. Every <em>loved one.</em>
          </h1>
        </div>

        {/* Centerpiece Poster (server-rendered LCP element; hides visually when 3D canvas takes over in Phase 2) */}
        <div
          ref={posterWrapRef}
          className={styles.stage}
          data-has-canvas={hasCanvas}
        >
          <div className={styles.posterFrame}>
            <Image
              src="/posters/hero-poster.svg"
              alt="MedBuddy phone cabinet preview showing In date, Use soon, and Expired medicine cards surrounded by a luminous ring and pill helix"
              width={1200}
              height={1000}
              priority
              className={styles.posterImg}
            />
          </div>
        </div>

        {/* Pinned Frosted-Glass Cards */}
        <div className={styles.cardNextDose}>
          <GlassCard
            title="Next dose"
            summary="Metformin 500 mg · 8:00 PM"
            statusLabel="On schedule"
            statusTone="ok"
            compactOnMobile
            details={
              <p>
                One-tap Taken, Skipped, or Snoozed logging updates your remaining tablet count
                automatically.
              </p>
            }
          />
        </div>

        <div className={styles.cardExpiring}>
          <GlassCard
            title="Expiring soon"
            summary="Eye Drops (Opened) · 7 days left"
            statusLabel="7 day alert"
            statusTone="warn"
            compactOnMobile
            details={
              <p>
                Opened-date tracking alerts you at 30, 15, and 7 days, with safe-disposal guidance
                once past date.
              </p>
            }
          />
        </div>

        {/* Bottom bar: Mono Spec Sheet + Calm Intro + Primary/Secondary CTAs */}
        <div className={styles.bottomRow}>
          <div className={styles.specBlock} aria-hidden="true">
            <span>SPECIMEN: MEDBUDDY</span>
            <span>STATE: ACTIVE</span>
            <span>MISSION: NEVER MISS A DOSE</span>
          </div>

          <div className={styles.ctaGroup}>
            <p className={styles.lead}>
              Track expiry dates, dose reminders, and refills for you and the family who look
              after you.
            </p>
            <div className={styles.buttons}>
              {onInstallClick ? (
                <PillButton variant="primary" onClick={onInstallClick}>
                  Install MedBuddy
                </PillButton>
              ) : (
                <PillButton variant="primary" href="#install">
                  Install MedBuddy
                </PillButton>
              )}
              <PillButton variant="secondary" href="#how-it-works">
                See how it works
              </PillButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
