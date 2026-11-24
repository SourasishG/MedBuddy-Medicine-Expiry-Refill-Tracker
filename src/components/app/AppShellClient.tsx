'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LazyMotion } from 'framer-motion';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { ProfileSwitcherSheet } from './ProfileSwitcherSheet';
import styles from './AppShell.module.scss';

const loadMotionFeatures = () => import('framer-motion').then((mod) => mod.domAnimation);

export function AppShellClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isStandalone =
    pathname === '/app/sign-in' ||
    pathname === '/app/consent' ||
    pathname.startsWith('/app/setup') ||
    pathname === '/app/medicine/add';

  return (
    <LazyMotion features={loadMotionFeatures}>
      <div className={styles.appContainer}>
        <div className={styles.centerColumn}>
          {!isStandalone && <AppHeader />}
          <main
            id="main-content"
            className={isStandalone ? styles.standaloneContent : styles.mainContent}
          >
            {children}
          </main>
          {!isStandalone && <BottomNav />}
          {!isStandalone && <ProfileSwitcherSheet />}
        </div>
      </div>
    </LazyMotion>
  );
}
