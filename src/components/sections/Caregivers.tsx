'use client';

import { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { sceneTargets } from '@/lib/sceneState';
import styles from './Caregivers.module.scss';

export function Caregivers() {
  const sectionRef = useRef<HTMLElement>(null);
  const hasAutoPlayedRef = useRef(false);
  const [doseMissed, setDoseMissed] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const { motionEnabled } = useMotionPreference();

  const triggerMissedEvent = () => {
    setDoseMissed(true);
    setPulseKey((k) => k + 1);
    if (motionEnabled) {
      void import('@/lib/gsap').then(({ gsap }) => {
        gsap.killTweensOf(sceneTargets, 'glitchPulse');
        gsap.fromTo(
          sceneTargets,
          { glitchPulse: 0.85 },
          { glitchPulse: 0, duration: 0.26, ease: 'power2.out' },
        );
      });
    }
  };

  useEffect(() => {
    if (!motionEnabled || hasAutoPlayedRef.current) return;
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !hasAutoPlayedRef.current) {
          hasAutoPlayedRef.current = true;
          triggerMissedEvent();
          observer.disconnect();
        }
      },
      { threshold: 0.42 },
    );

    observer.observe(section);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionEnabled]);

  return (
    <section
      id="family"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="caregivers-heading"
    >
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <header className={styles.header}>
            <div className={styles.labelRow}>
              <span className={styles.monoLabel}>05 / FOR CAREGIVERS</span>
              <span className={styles.illustrativePill}>Illustrative</span>
            </div>
            <h2 id="caregivers-heading" className={styles.title}>
              Know they took today’s dose without <em>hovering.</em>
            </h2>
            <p className={styles.lead}>
              Share adherence calmly with the relatives who look after you. When a scheduled dose is
              logged, family members see the update without another phone call. If a dose is missed,
              the caregiver is alerted right away.
            </p>
          </header>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.triggerBtn}
              data-missed={doseMissed}
              onClick={() => {
                if (doseMissed) {
                  setDoseMissed(false);
                } else {
                  triggerMissedEvent();
                }
              }}
            >
              {doseMissed ? 'Reset to dose taken' : 'Simulate missed dose'}
            </button>
          </div>
        </div>

        <div className={styles.stageCard}>
          <div className={styles.pairGrid}>
            {/* Parent's Phone */}
            <article
              className={styles.phoneFrame}
              data-dimmed={doseMissed}
              aria-label="Parent phone illustrative state"
            >
              <div className={styles.phoneTop}>
                <span className={styles.phoneOwner}>PARENT PHONE · MOM</span>
                <span className={styles.phoneState} data-tone={doseMissed ? 'alert' : 'ok'}>
                  {doseMissed ? '! NOT LOGGED' : '✓ TAKEN'}
                </span>
              </div>

              <div className={styles.phoneBody}>
                <h3 className={styles.medTitle}>Metformin 500 mg</h3>
                <p className={styles.medDetail}>
                  {doseMissed
                    ? 'Scheduled 8:00 PM dose still unlogged after 30 minutes.'
                    : 'Logged Taken at 8:04 PM · Remaining count updated to 41 tablets.'}
                </p>
              </div>

              <div className={styles.phoneMetaRow}>
                <span>Large-text mode ready</span>
                <span>{doseMissed ? 'Reminder waiting' : 'Synced'}</span>
              </div>
            </article>

            {/* Glowing Connecting Thread */}
            <div className={styles.threadWrap} aria-live="polite">
              <div className={styles.threadTrack} data-missed={doseMissed}>
                <m.span
                  key={`${doseMissed}-${pulseKey}`}
                  className={styles.threadPulse}
                  data-missed={doseMissed}
                  initial={motionEnabled ? { scale: 0.75, opacity: 0.55 } : false}
                  animate={{ scale: doseMissed ? [0.85, 1.35, 1] : 1, opacity: 1 }}
                  transition={{
                    duration: motionEnabled ? 0.65 : 0.001,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>
              <span className={styles.threadCaption} data-missed={doseMissed}>
                {doseMissed ? 'MISSED DOSE SIGNAL SENT' : 'SHARED ADHERENCE ACTIVE'}
              </span>
            </div>

            {/* Caregiver's Phone */}
            <article
              className={styles.phoneFrame}
              data-alert={doseMissed}
              aria-label="Caregiver phone illustrative state"
            >
              <div className={styles.phoneTop}>
                <span className={styles.phoneOwner}>CAREGIVER PHONE</span>
                <span className={styles.phoneState} data-tone={doseMissed ? 'alert' : 'ok'}>
                  {doseMissed ? '! MISSED DOSE ALERT' : '✓ IN SYNC'}
                </span>
              </div>

              <div className={styles.phoneBody}>
                <h3 className={styles.medTitle}>
                  {doseMissed ? 'Mom missed the 8:00 PM dose' : 'All evening doses logged'}
                </h3>
                <p className={styles.medDetail}>
                  {doseMissed
                    ? 'Metformin 500 mg was due 30 min ago. Check in or view today’s adherence log.'
                    : 'Today’s schedule is complete. Download a clean summary before the next doctor visit.'}
                </p>
              </div>

              <div className={styles.phoneMetaRow}>
                <span>Family sharing</span>
                <span>Doctor-ready PDF report</span>
              </div>
            </article>
          </div>

          <div className={styles.highlightsRow}>
            <div className={styles.highlightItem}>
              <h3 className={styles.highlightTitle}>Calm check-ins</h3>
              <p className={styles.highlightCopy}>
                Caregivers see whether a dose was taken without having to call twice a day.
              </p>
            </div>
            <div className={styles.highlightItem}>
              <h3 className={styles.highlightTitle}>Missed-dose alerts</h3>
              <p className={styles.highlightCopy}>
                If a scheduled dose goes unlogged, an alert notifies the connected caregiver.
              </p>
            </div>
            <div className={styles.highlightItem}>
              <h3 className={styles.highlightTitle}>Doctor-ready PDF report</h3>
              <p className={styles.highlightCopy}>
                Export clear adherence records ahead of clinic appointments in a couple of taps.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
