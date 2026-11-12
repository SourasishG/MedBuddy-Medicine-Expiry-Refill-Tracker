'use client';

import { PillButton } from '@/components/ui/PillButton';
import styles from './offline.module.scss';

export default function OfflinePage() {
  return (
    <main id="main-content" className={styles.shell}>
      <section className={styles.card} aria-labelledby="offline-heading">
        <span className={styles.mono}>OFFLINE FALLBACK</span>
        <h1 id="offline-heading" className={styles.heading}>
          You appear to be offline.
        </h1>
        <p className={styles.copy}>
          MedBuddy could not reach the network just now. Check your connection and try again, or
          open your installed early-access shell.
        </p>
        <div className={styles.actions}>
          <PillButton variant="primary" onClick={() => window.location.reload()}>
            Try again
          </PillButton>
          <PillButton variant="secondary" href="/app">
            Open shell
          </PillButton>
        </div>
      </section>
    </main>
  );
}
