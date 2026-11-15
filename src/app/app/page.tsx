'use client';

import Link from 'next/link';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import styles from './today.module.scss';

export default function TodayPage() {
  const { activeCareProfile, isLoading } = useCareProfile();

  if (isLoading) {
    return (
      <div className={styles.todayContainer}>
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Loading schedule…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.todayContainer}>
      <div className={styles.banner} role="status">
        <div className={styles.bannerContent}>
          <svg
            className={styles.bannerIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span>Reminders are off for this browser.</span>
        </div>
        <Link href="/app/settings" className={styles.bannerBtn}>
          Enable
        </Link>
      </div>

      <div className={styles.emptyState}>
        <div className={styles.emptyIconRing} aria-hidden="true">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 14 14" />
          </svg>
        </div>

        <h1 className={styles.emptyTitle}>
          No doses scheduled for {activeCareProfile?.name || 'today'}
        </h1>

        <p className={styles.emptyText}>
          Your medicine cabinet is empty. Add your medicines and set times to receive calm daily
          reminders.
        </p>

        <Link href="/app/medicine/add" className={styles.addBtn}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add first medicine</span>
        </Link>
      </div>
    </div>
  );
}
