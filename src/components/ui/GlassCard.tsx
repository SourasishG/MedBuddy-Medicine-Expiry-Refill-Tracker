'use client';

import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import styles from './GlassCard.module.scss';

export type StatusTone = 'ok' | 'warn' | 'alert' | 'neutral';

export interface GlassCardProps {
  title: string;
  summary: string;
  statusLabel: string;
  statusTone?: StatusTone;
  badgeTag?: string;
  details: ReactNode;
  defaultExpanded?: boolean;
  compactOnMobile?: boolean;
  className?: string;
}

function StatusIcon({ tone }: { tone: StatusTone }) {
  if (tone === 'ok') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeOpacity="0.45" />
        <path
          d="M4.3 7.2L6.1 9L9.8 5.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tone === 'warn') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeOpacity="0.45" />
        <path d="M7 4.2V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="7" cy="9.9" r="0.85" fill="currentColor" />
      </svg>
    );
  }
  if (tone === 'alert') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeOpacity="0.5" />
        <path
          d="M5 5L9 9M9 5L5 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4" fill="currentColor" fillOpacity="0.7" />
    </svg>
  );
}

export function GlassCard({
  title,
  summary,
  statusLabel,
  statusTone = 'neutral',
  badgeTag = 'Illustrative',
  details,
  defaultExpanded = false,
  compactOnMobile = false,
  className,
}: GlassCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { motionEnabled } = useMotionPreference();
  const panelId = useId();

  return (
    <article
      className={[styles.card, compactOnMobile ? styles.compactMobile : '', className]
        .filter(Boolean)
        .join(' ')}
      data-expanded={expanded}
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((prev) => !prev)}
          data-cursor="interactive"
        >
          <span className={styles.meta}>
            <span className={styles.status} data-tone={statusTone}>
              <StatusIcon tone={statusTone} />
              <span>{statusLabel}</span>
            </span>
            <span className={styles.title}>{title}</span>
            <span className={styles.summary}>{summary}</span>
          </span>
          <span className={styles.plusWrap} aria-hidden="true">
            <span className={styles.plusLine} />
            <span className={styles.plusLineVertical} />
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            className={styles.bodyWrap}
            initial={motionEnabled ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={motionEnabled ? { height: 0, opacity: 0 } : { opacity: 0 }}
            transition={
              motionEnabled
                ? { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0.001 }
            }
          >
            <div className={styles.body}>
              <div className={styles.details}>{details}</div>
              <span className={styles.tag}>{badgeTag}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
