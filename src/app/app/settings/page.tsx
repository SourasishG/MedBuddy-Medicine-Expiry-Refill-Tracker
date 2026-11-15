'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import styles from './settings.module.scss';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isLargeText, setLargeText, activeCareProfile } = useCareProfile();
  const [, startTransition] = useTransition();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace('/app/sign-in');
    });
  };

  return (
    <div className={styles.settingsContainer}>
      <h1 className={styles.heading}>Settings</h1>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Appearance & Comfort</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Large text</div>
              <div className={styles.rowDesc}>
                Scales medicine text, buttons and doses for easier reading.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isLargeText}
              className={styles.toggle}
              data-checked={isLargeText}
              onClick={() => setLargeText(!isLargeText)}
            >
              <div className={styles.toggleKnob} />
            </button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Active Profile</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>{activeCareProfile?.name || 'Care Profile'}</div>
              <div className={styles.rowDesc}>Timezone: {activeCareProfile?.timezone}</div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Account</div>
        <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
          Sign out of MedBuddy
        </button>
      </section>
    </div>
  );
}
