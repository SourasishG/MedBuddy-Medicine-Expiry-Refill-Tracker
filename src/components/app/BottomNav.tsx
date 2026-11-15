'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AppShell.module.scss';

export function BottomNav() {
  const pathname = usePathname();

  const isToday = pathname === '/app';
  const isCabinet = pathname.startsWith('/app/cabinet');
  const isSettings = pathname.startsWith('/app/settings');

  return (
    <nav className={styles.bottomNav} aria-label="Main App Navigation">
      <Link
        href="/app"
        className={styles.navItem}
        data-active={isToday}
        aria-current={isToday ? 'page' : undefined}
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <span className={styles.navLabel}>Today</span>
      </Link>

      <Link
        href="/app/cabinet"
        className={styles.navItem}
        data-active={isCabinet}
        aria-current={isCabinet ? 'page' : undefined}
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="9" y1="12" x2="10" y2="12" />
          <line x1="14" y1="12" x2="15" y2="12" />
        </svg>
        <span className={styles.navLabel}>Cabinet</span>
      </Link>

      <Link
        href="/app/medicine/add"
        className={styles.addBtn}
        aria-label="Add medicine"
      >
        <svg className={styles.addIcon} viewBox="0 0 24 24" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>

      <Link
        href="/app/settings"
        className={styles.navItem}
        data-active={isSettings}
        aria-current={isSettings ? 'page' : undefined}
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span className={styles.navLabel}>Settings</span>
      </Link>
    </nav>
  );
}
