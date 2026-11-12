import type { Metadata } from 'next';
import { PillButton } from '@/components/ui/PillButton';
import styles from './app.module.scss';

export const metadata: Metadata = {
  title: 'MedBuddy — Launching Soon',
  description:
    'MedBuddy is launching soon. You have installed it early, and it will update itself when the app goes live.',
};

export default function AppShellPage() {
  return (
    <main id="main-content" className={styles.shell}>
      <section className={styles.card} aria-labelledby="app-shell-heading">
        <div className={styles.markRing} aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 64 64" fill="none">
            <rect
              x="21"
              y="26"
              width="22"
              height="12"
              rx="6"
              transform="rotate(-35 32 32)"
              stroke="#EAF0F6"
              strokeWidth="2.4"
            />
            <circle cx="38" cy="26" r="3.4" fill="#5CF2C7" />
          </svg>
        </div>

        <div className={styles.wordmark}>MEDBUDDY</div>
        <span className={styles.statusBadge}>EARLY ACCESS SHELL · INSTALLED</span>

        <h1 id="app-shell-heading" className={styles.heading}>
          Ready on your <em>home screen.</em>
        </h1>

        <p className={styles.copy}>
          MedBuddy is launching soon. You’ve installed it early, and it will update itself when the
          app goes live.
        </p>

        <div className={styles.actions}>
          <PillButton variant="secondary" href="/">
            Back to MedBuddy website
          </PillButton>
        </div>

        <p className={styles.note}>
          MedBuddy is a reminder and tracking tool. It does not provide medical advice, diagnosis or
          treatment. Always follow your doctor’s instructions.
        </p>
      </section>
    </main>
  );
}
