'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import styles from './consent.module.scss';

type ConsentDoc = Database['public']['Enums']['consent_doc'];

export default function ConsentPage() {
  const router = useRouter();
  const supabase = createClient();
  const [, startTransition] = useTransition();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if consent was already recorded
  useEffect(() => {
    async function checkExisting() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        startTransition(() => {
          router.replace('/app/sign-in');
        });
        return;
      }

      const { data: consents } = await supabase
        .from('consents')
        .select('id')
        .eq('user_id', user.id)
        .is('withdrawn_at', null)
        .limit(1);

      if (consents && consents.length > 0) {
        startTransition(() => {
          router.replace('/app');
        });
      }
    }

    void checkExisting();
  }, [supabase, router]);

  const handleAgree = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/app/sign-in');
        return;
      }

      const docs: ConsentDoc[] = ['terms', 'privacy', 'health_data'];
      const inserts = docs.map((doc) => ({
        user_id: user.id,
        document: doc,
        version: '1.0',
      }));

      const { error } = await supabase.from('consents').insert(inserts);

      if (error) {
        setErrorMessage('Could not record your agreement. Please try again.');
        setIsLoading(false);
        return;
      }

      // Navigate to app; middleware will guide to /app/setup or /app
      startTransition(() => {
        router.replace('/app');
      });
    } catch {
      setErrorMessage('A network error occurred. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace('/app/sign-in');
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.badge}>YOUR PRIVACY & DATA</span>
          <h1 className={styles.title}>Plain-language agreement</h1>
          <p className={styles.intro}>
            Before using MedBuddy, here is a clear summary of how your medication information is
            stored and protected:
          </p>
        </div>

        {errorMessage && (
          <div className={styles.errorBox} role="alert">
            {errorMessage}
          </div>
        )}

        <div className={styles.summaryList}>
          <div className={styles.summaryItem}>
            <svg
              className={styles.itemIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
            <div className={styles.itemText}>
              <div className={styles.itemTitle}>What is stored</div>
              <div className={styles.itemDescription}>
                Medicine names, strengths, quantities, expiry dates, schedules, and dose logs you
                enter.
              </div>
            </div>
          </div>

          <div className={styles.summaryItem}>
            <svg
              className={styles.itemIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div className={styles.itemText}>
              <div className={styles.itemTitle}>Why we store it</div>
              <div className={styles.itemDescription}>
                To calculate expiry bands, send you timely dose and refill reminders, and help you
                track doses.
              </div>
            </div>
          </div>

          <div className={styles.summaryItem}>
            <svg
              className={styles.itemIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div className={styles.itemText}>
              <div className={styles.itemTitle}>Who can see it</div>
              <div className={styles.itemDescription}>
                Only you. We never sell your health data, show third-party ads, or share it with
                insurers.
              </div>
            </div>
          </div>

          <div className={styles.summaryItem}>
            <svg
              className={styles.itemIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className={styles.itemText}>
              <div className={styles.itemTitle}>Not medical advice</div>
              <div className={styles.itemDescription}>
                MedBuddy is an adherence assistant. It does not provide medical advice or
                prescriptions. Always follow your doctor&apos;s instructions.
              </div>
            </div>
          </div>

          <div className={styles.summaryItem}>
            <svg
              className={styles.itemIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <div className={styles.itemText}>
              <div className={styles.itemTitle}>Right to delete</div>
              <div className={styles.itemDescription}>
                You can export your complete history or permanently erase your account and all data
                at any time in Settings.
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.agreeBtn}
            onClick={handleAgree}
            disabled={isLoading}
          >
            {isLoading ? 'Saving agreement…' : 'I agree and continue'}
          </button>

          <div className={styles.footerLinks}>
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">
              Read full privacy notice
            </Link>
            <button type="button" onClick={handleSignOut} disabled={isLoading}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
