'use client';

import { useMemo, useState } from 'react';
import { m } from 'framer-motion';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import styles from './CabinetDemo.module.scss';

type MedicineStatus = 'ok' | 'warn' | 'alert';

interface CabinetMedicine {
  id: string;
  name: string;
  location: string;
  quantity: string;
  baseDaysLeft: number;
  isOpenedWindow?: boolean;
}

const SAMPLE_CABINET: CabinetMedicine[] = [
  {
    id: 'cough-syrup',
    name: 'Cough Syrup',
    location: 'Bathroom shelf · Opened bottle',
    quantity: '90 ml left',
    baseDaysLeft: 3,
    isOpenedWindow: true,
  },
  {
    id: 'eye-drops',
    name: 'Eye Drops (Opened)',
    location: 'Bedside table · Opened 18d ago',
    quantity: '1 bottle',
    baseDaysLeft: 10,
    isOpenedWindow: true,
  },
  {
    id: 'ibuprofen',
    name: 'Ibuprofen 200 mg',
    location: 'Hallway drawer · Batch #B2409',
    quantity: '12 tablets',
    baseDaysLeft: 35,
  },
  {
    id: 'metformin',
    name: 'Metformin 500 mg',
    location: 'Kitchen shelf · Batch #M812',
    quantity: '42 tablets',
    baseDaysLeft: 54,
  },
  {
    id: 'vitamin-d3',
    name: 'Vitamin D3 1000 IU',
    location: 'Dining table · Batch #V319',
    quantity: '28 tablets',
    baseDaysLeft: 72,
  },
  {
    id: 'calcium',
    name: 'Calcium Citrate',
    location: 'Pantry cabinet · Batch #C105',
    quantity: '60 tablets',
    baseDaysLeft: 86,
  },
];

const PRESET_DAYS = [0, 14, 45, 90] as const;

function getStatus(daysRemaining: number): MedicineStatus {
  if (daysRemaining <= 0) return 'alert';
  if (daysRemaining <= 30) return 'warn';
  return 'ok';
}

function getStatusLabel(status: MedicineStatus): string {
  if (status === 'ok') return 'In date';
  if (status === 'warn') return 'Use soon';
  return 'Expired';
}

function StatusIcon({ status }: { status: MedicineStatus }) {
  if (status === 'ok') {
    return (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M2.5 7.2L5.6 10.2L11.5 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === 'warn') {
    return (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M7 3.2V7.6M7 10.2V10.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3.6 3.6L10.4 10.4M10.4 3.6L3.6 10.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CabinetDemo() {
  const [daysOffset, setDaysOffset] = useState(0);
  const { motionEnabled } = useMotionPreference();

  const evaluated = useMemo(() => {
    const items = SAMPLE_CABINET.map((item) => {
      const remaining = item.baseDaysLeft - daysOffset;
      const status = getStatus(remaining);
      return {
        ...item,
        remaining,
        status,
        label: getStatusLabel(status),
      };
    });

    const counts = {
      ok: items.filter((item) => item.status === 'ok').length,
      warn: items.filter((item) => item.status === 'warn').length,
      alert: items.filter((item) => item.status === 'alert').length,
    };

    const prioritized = [...items].sort((a, b) => {
      const aExpired = a.remaining <= 0;
      const bExpired = b.remaining <= 0;
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      return a.remaining - b.remaining;
    });

    return { items, counts, prioritized };
  }, [daysOffset]);

  return (
    <section id="cabinet-demo" className={styles.section} aria-labelledby="cabinet-demo-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.labelRow}>
            <span className={styles.monoLabel}>04 / LIVE DEMO</span>
            <span className={styles.illustrativePill}>Illustrative</span>
          </div>
          <h2 id="cabinet-demo-heading" className={styles.title}>
            See how every bottle counts down <em>in real time.</em>
          </h2>
          <p className={styles.lead}>
            Slide forward up to 90 days to watch opened bottles and strips shift from green to amber
            at 30, 15, and 7 day windows, then red for safe disposal. Sample cabinet below is
            illustrative.
          </p>
        </header>

        <div className={styles.board}>
          <div className={styles.controlsBar}>
            <div className={styles.sliderWrap}>
              <div className={styles.sliderHeader}>
                <label htmlFor="days-from-today-slider" className={styles.sliderLabel}>
                  Days from today
                </label>
                <span className={styles.daysReadout} aria-live="polite">
                  +{daysOffset} {daysOffset === 1 ? 'DAY' : 'DAYS'}
                </span>
              </div>
              <input
                id="days-from-today-slider"
                type="range"
                min={0}
                max={90}
                value={daysOffset}
                onChange={(e) => setDaysOffset(Number(e.target.value))}
                className={styles.rangeInput}
                aria-valuemin={0}
                aria-valuemax={90}
                aria-valuenow={daysOffset}
                aria-valuetext={`${daysOffset} days from today`}
              />
            </div>

            <div className={styles.presetRow} role="group" aria-label="Jump to day offset">
              {PRESET_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={styles.presetBtn}
                  data-active={daysOffset === day}
                  onClick={() => setDaysOffset(day)}
                >
                  {day === 0 ? 'Today (0d)' : `+${day}d`}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.summaryStrip} aria-live="polite">
            <span className={styles.summaryBadge} data-tone="ok">
              <StatusIcon status="ok" />
              <span>{evaluated.counts.ok} In date</span>
            </span>
            <span className={styles.summaryBadge} data-tone="warn">
              <StatusIcon status="warn" />
              <span>{evaluated.counts.warn} Use soon</span>
            </span>
            <span className={styles.summaryBadge} data-tone="alert">
              <StatusIcon status="alert" />
              <span>{evaluated.counts.alert} Expired</span>
            </span>
          </div>

          <div className={styles.bottleGrid} aria-label="Illustrative medicine bottles">
            {evaluated.items.map((item) => (
              <article
                key={item.id}
                className={styles.bottleCard}
                data-status={item.status}
                data-bottle-id={item.id}
              >
                <div className={styles.bottleTop}>
                  <div>
                    <h3 className={styles.bottleName}>{item.name}</h3>
                    <p className={styles.bottleMeta}>{item.location}</p>
                  </div>
                  <span className={styles.statusTag} data-status={item.status}>
                    <StatusIcon status={item.status} />
                    <span>{item.label}</span>
                  </span>
                </div>

                <div className={styles.bottleFooter}>
                  <span>{item.quantity}</span>
                  {item.remaining <= 0 ? (
                    <span className={styles.disposalNote}>
                      Past {Math.abs(item.remaining)}d · Safe disposal
                    </span>
                  ) : (
                    <span>
                      {item.isOpenedWindow ? 'Opened limit' : 'Expires'} in {item.remaining}d
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <aside className={styles.priorityPanel} aria-label="Use these first priority order">
            <div className={styles.priorityHeader}>
              <h3 className={styles.priorityTitle}>Use these first</h3>
              <p className={styles.prioritySub}>Re-sorts automatically by earliest date</p>
            </div>

            <ol className={styles.priorityList}>
              {evaluated.prioritized.map((item, idx) => (
                <m.li
                  key={item.id}
                  layout={motionEnabled}
                  transition={{ duration: motionEnabled ? 0.35 : 0, ease: [0.22, 1, 0.36, 1] }}
                  className={styles.priorityItem}
                  data-status={item.status}
                >
                  <span className={styles.priorityRank}>0{idx + 1}</span>
                  <div className={styles.priorityInfo}>
                    <div className={styles.priorityName}>{item.name}</div>
                    <div className={styles.priorityDetail}>
                      {item.remaining <= 0
                        ? 'Expired — do not take'
                        : `${item.label} · ${item.quantity}`}
                    </div>
                  </div>
                  <span className={styles.priorityDays} data-status={item.status}>
                    {item.remaining <= 0 ? 'DISPOSE' : `${item.remaining}d left`}
                  </span>
                </m.li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </section>
  );
}
