'use client';

import { useEffect, useRef } from 'react';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { loadGsapPlugins } from '@/lib/gsap';
import styles from './Problem.module.scss';

const STATEMENTS = [
  {
    num: '01',
    headline: 'Expired medicines hide in the cabinet.',
    detail:
      'Strips, syrups, and eye drops sit past their shelf or opened dates without a clear warning.',
  },
  {
    num: '02',
    headline: 'Doses get missed and refills run out.',
    detail:
      'Daily schedules blur together, and bottles run empty before anyone checks what is left.',
  },
  {
    num: '03',
    headline: 'Families can’t tell if a parent took their pills.',
    detail:
      'Relatives are left calling and worrying when a dose is forgotten across separate homes.',
  },
] as const;

export function Problem() {
  const sectionRef = useRef<HTMLElement>(null);
  const { motionEnabled, isHydrated } = useMotionPreference();

  useEffect(() => {
    if (!isHydrated || !motionEnabled) return;

    const section = sectionRef.current;
    if (!section) return;

    let cancelled = false;
    let revertCtx: (() => void) | undefined;

    void loadGsapPlugins().then(({ gsap, SplitText }) => {
      if (cancelled || !sectionRef.current) return;
      const ctx = gsap.context(() => {
        const headings = section.querySelectorAll<HTMLElement>('[data-problem-heading]');
        headings.forEach((heading) => {
          const split = SplitText.create(heading, { type: 'lines', mask: 'lines' });
          gsap.from(split.lines, {
            yPercent: 105,
            opacity: 0,
            duration: 0.95,
            stagger: 0.06,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: heading,
              start: 'top 82%',
              once: true,
            },
          });
        });
      }, section);

      revertCtx = () => ctx.revert();
    });

    return () => {
      cancelled = true;
      revertCtx?.();
    };
  }, [isHydrated, motionEnabled]);

  return (
    <section
      id="problem"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="problem-label"
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <p id="problem-label" className={styles.sectionCode}>
            01 / THE PROBLEM
          </p>
          <p className={styles.intro}>
            Medicine cabinets grow quiet and confusing over time. Three small gaps cause most of the
            stress.
          </p>
        </header>

        <ol className={styles.list}>
          {STATEMENTS.map((item) => (
            <li key={item.num} className={styles.row} data-problem-row={item.num}>
              <span className={styles.numeral} aria-hidden="true">
                {item.num}
              </span>
              <div className={styles.content}>
                <h2 className={styles.statement} data-problem-heading>
                  {item.headline}
                </h2>
                <p className={styles.detail}>{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
