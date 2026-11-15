'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import styles from './setup.module.scss';

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode'); // e.g. 'new' when adding from sheet
  const isAddingNew = mode === 'new';

  const supabase = createClient();
  const { refetchProfiles, setActiveProfileId } = useCareProfile();
  const [, startTransition] = useTransition();

  const [isMe, setIsMe] = useState(true);
  const [name, setName] = useState('');
  const [enableReminders, setEnableReminders] = useState(true);
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    } catch {
      return 'Asia/Kolkata';
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If first run, prefill name with user's name if available
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        startTransition(() => {
          router.replace('/app/sign-in');
        });
        return;
      }

      if (isMe && !name) {
        const metadataName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          (user.email ? user.email.split('@')[0] : 'Myself');
        setName(metadataName);
      }
    }
    void loadUser();
  }, [supabase, router, isMe, name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage('Please enter a name for this care profile.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { data: profileId, error } = await supabase.rpc('fn_create_care_profile', {
        p_name: cleanName,
        p_is_me: isMe,
        p_timezone: timezone,
      });

      if (error || !profileId) {
        setErrorMessage(
          error?.message
            ? `Could not create profile: ${error.message}`
            : 'Could not create profile. Please check the details and try again.',
        );
        setIsSubmitting(false);
        return;
      }

      await refetchProfiles();
      setActiveProfileId(profileId);

      // Offer browser notification permission if requested
      if (enableReminders && typeof window !== 'undefined' && 'Notification' in window) {
        try {
          if (Notification.permission === 'default') {
            await Notification.requestPermission();
          }
        } catch {
          // Non-blocking notification permission error
        }
      }

      // Invalidate cached state so middleware recognizes setup is complete
      document.cookie = 'medbuddy_app_state=; path=/app; max-age=0';

      router.replace('/app');
      router.refresh();
    } catch {
      setErrorMessage('A network error occurred. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div>
          <span className={styles.badge}>
            {isAddingNew ? 'NEW CARE PROFILE' : 'FIRST-TIME SETUP'}
          </span>
          <h1 className={styles.title}>
            {isAddingNew ? 'Add someone to care for' : 'Who is this for?'}
          </h1>
          <p className={styles.subtitle}>
            {isAddingNew
              ? 'Keep their medicines, schedules, and refill reminders organized separately.'
              : 'MedBuddy organizes medicines by care profile, so you can track yourself or someone you look after.'}
          </p>
        </div>

        {errorMessage && (
          <div className={styles.errorBox} role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.optionGrid} role="radiogroup" aria-label="Who is this for?">
            <button
              type="button"
              role="radio"
              aria-checked={isMe}
              className={styles.optionBtn}
              data-selected={isMe}
              onClick={() => {
                setIsMe(true);
                if (!name || name === 'Mom' || name === 'Dad' || name === 'Child') {
                  setName('Myself');
                }
              }}
            >
              <svg className={styles.optionIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className={styles.optionLabel}>For myself</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={!isMe}
              className={styles.optionBtn}
              data-selected={!isMe}
              onClick={() => {
                setIsMe(false);
                if (name === 'Myself') setName('');
              }}
            >
              <svg className={styles.optionIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className={styles.optionLabel}>Someone else</span>
            </button>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="name-input" className={styles.label}>
              {isMe ? 'Your display name' : 'Their name'}
            </label>
            <input
              id="name-input"
              type="text"
              className={styles.input}
              placeholder={isMe ? 'e.g. Alex' : 'e.g. Mum, Grandpa, Maya'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="timezone-select" className={styles.label}>
              Time zone (for dose reminders)
            </label>
            <select
              id="timezone-select"
              className={styles.select}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="America/Chicago">America/Chicago (CST/CDT)</option>
              <option value="America/Denver">America/Denver (MST/MDT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
              <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          {!isAddingNew && (
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={enableReminders}
                  onChange={(e) => setEnableReminders(e.target.checked)}
                  className={styles.checkbox}
                />
                <div>
                  <div className={styles.checkboxTitle}>Turn on dose reminders</div>
                  <div className={styles.checkboxDesc}>
                    Receive calm notifications when doses are due (optional, can be turned off
                    anytime in Settings)
                  </div>
                </div>
              </label>
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            {isSubmitting ? 'Creating profile…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.title}>Loading setup…</div>
          </div>
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
