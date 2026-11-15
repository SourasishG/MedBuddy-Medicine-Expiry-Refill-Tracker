'use client';

import Link from 'next/link';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import styles from '../today.module.scss';

export default function CabinetPage() {
  const { activeCareProfile, isLoading } = useCareProfile();

  if (isLoading) {
    return (
      <div className={styles.skeletonContainer} aria-busy="true" aria-label="Loading cabinet">
        <div className={styles.skeletonCard}>
          <div className={styles.shimmer} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.todayContainer}>
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
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        </div>

        <h1 className={styles.emptyTitle}>Cabinet for {activeCareProfile?.name || 'you'}</h1>

        <p className={styles.emptyText}>
          No medicines stored yet. Keep track of expiry dates, batches, and remaining stock.
        </p>

        <Link href="/app/medicine/add" className={styles.addBtn}>
          <span>Add a medicine</span>
        </Link>
      </div>
    </div>
  );
}
