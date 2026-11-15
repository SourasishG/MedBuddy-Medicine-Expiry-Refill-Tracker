'use client';

import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import styles from './AppShell.module.scss';

export function AppHeader() {
  const { activeCareProfile, activeRole, setSwitcherOpen } = useCareProfile();

  const timeZone = activeCareProfile?.timezone || 'Asia/Kolkata';
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date());

  const initial = (activeCareProfile?.name || 'M').charAt(0).toUpperCase();

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.profileSwitcherBtn}
        onClick={() => setSwitcherOpen(true)}
        aria-label={`Switch care profile. Current profile is ${activeCareProfile?.name || 'Care Profile'}`}
        aria-haspopup="dialog"
      >
        <span className={styles.avatarInitial} aria-hidden="true">
          {initial}
        </span>
        <div className={styles.profileInfo}>
          <span className={styles.profileName}>{activeCareProfile?.name || 'Care Profile'}</span>
          <span className={styles.profileRoleBadge}>{activeRole}</span>
        </div>
      </button>

      <span className={styles.headerDate}>{formattedDate}</span>
    </header>
  );
}
