'use client';

import { GlassCard, type StatusTone } from '@/components/ui/GlassCard';
import styles from './Features.module.scss';

interface FeatureCardItem {
  id: string;
  title: string;
  summary: string;
  statusLabel: string;
  statusTone: StatusTone;
  details: string;
  layer: 'left' | 'right';
}

const FEATURES: FeatureCardItem[] = [
  {
    id: 'smart-cabinet',
    title: 'Smart cabinet',
    summary: 'Scan strips or add by hand',
    statusLabel: 'In date · Organised',
    statusTone: 'ok',
    details:
      'Add medicines manually or by scanning the strip or box. Keep track of quantity, expiry date, batch number, and where each bottle is stored.',
    layer: 'left',
  },
  {
    id: 'dose-log',
    title: 'Dose log',
    summary: 'One-tap Taken, Skipped, or Snoozed',
    statusLabel: 'Updates stock',
    statusTone: 'ok',
    details:
      'Log any scheduled dose with a single tap. Every Taken confirmation updates your remaining tablet or bottle count automatically.',
    layer: 'right',
  },
  {
    id: 'refill-prediction',
    title: 'Refill prediction',
    summary: 'Calculated from stock and daily dose',
    statusLabel: 'Refill check',
    statusTone: 'warn',
    details:
      'MedBuddy calculates how many days remain from your current quantity and daily schedule so refills do not run out unannounced.',
    layer: 'left',
  },
  {
    id: 'expiry-alerts',
    title: 'Expiry alerts',
    summary: 'Warnings at 30, 15, and 7 days',
    statusLabel: '30 · 15 · 7 days',
    statusTone: 'warn',
    details:
      'Receive timely expiry alerts at 30, 15, and 7 days alongside a clear green, amber, and red cabinet view paired with status labels.',
    layer: 'right',
  },
  {
    id: 'opened-date',
    title: 'Opened-date tracking',
    summary: 'For syrups, eye drops, and ointments',
    statusLabel: 'Opened clock',
    statusTone: 'warn',
    details:
      'Track when bottles and tubes were opened, because syrups, eye drops, and ointments often expire sooner than the printed box date.',
    layer: 'left',
  },
  {
    id: 'disposal-guidance',
    title: 'Disposal guidance',
    summary: 'Clear steps for expired medicines',
    statusLabel: 'Safe disposal',
    statusTone: 'alert',
    details:
      'When a medicine passes its expiry or opened-date window, MedBuddy shows safe-disposal guidance instead of leaving it in the cabinet.',
    layer: 'right',
  },
  {
    id: 'doctor-report',
    title: 'Doctor-ready report',
    summary: 'Exportable PDF adherence summary',
    statusLabel: 'PDF summary',
    statusTone: 'neutral',
    details:
      'Generate a clean PDF adherence report summarizing logged doses over time to bring to clinic appointments.',
    layer: 'left',
  },
  {
    id: 'large-text',
    title: 'Large-text mode',
    summary: 'Effortless reading for elderly users',
    statusLabel: 'High legibility',
    statusTone: 'ok',
    details:
      'Switch on large-text mode for bigger labels, calmer spacing, and clear Taken / Skip / Snooze buttons built for older hands and eyes.',
    layer: 'right',
  },
];

export function Features() {
  const leftCards = FEATURES.filter((f) => f.layer === 'left');
  const rightCards = FEATURES.filter((f) => f.layer === 'right');

  return (
    <section id="features" className={styles.section} aria-labelledby="features-heading">
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.sectionCode}>03 / FEATURES</p>
          <h2 id="features-heading" className={styles.heading}>
            Every tool lifted straight out of the <em>cabinet.</em>
          </h2>
          <p className={styles.sub}>
            Open any card to see how MedBuddy tracks medicines, refills, and family peace of mind.
          </p>
        </header>

        <div className={styles.layers}>
          <div className={styles.column}>
            {leftCards.map((item) => (
              <GlassCard
                key={item.id}
                title={item.title}
                summary={item.summary}
                statusLabel={item.statusLabel}
                statusTone={item.statusTone}
                badgeTag="Product capability"
                details={<p>{item.details}</p>}
              />
            ))}
          </div>

          <div className={styles.centerSpacer} aria-hidden="true" />

          <div className={styles.column}>
            {rightCards.map((item) => (
              <GlassCard
                key={item.id}
                title={item.title}
                summary={item.summary}
                statusLabel={item.statusLabel}
                statusTone={item.statusTone}
                badgeTag="Product capability"
                details={<p>{item.details}</p>}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
