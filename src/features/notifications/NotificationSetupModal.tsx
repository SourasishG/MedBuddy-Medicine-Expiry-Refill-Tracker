'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeToPush } from './push-utils';
import styles from './NotificationSetupModal.module.scss';

interface NotificationSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribed?: () => void;
}

export function NotificationSetupModal({
  isOpen,
  onClose,
  onSubscribed,
}: NotificationSetupModalProps) {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = createClient();

  if (!isOpen) return null;

  const handleEnable = async () => {
    setIsSubscribing(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage('You must be signed in to configure notifications.');
        setIsSubscribing(false);
        return;
      }

      const res = await subscribeToPush(supabase, user.id);
      if (res.ok) {
        onSubscribed?.();
        onClose();
      } else {
        setErrorMessage(
          res.error ||
            'Could not enable notifications. Check your browser site settings and try again.',
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMessage(msg);
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubscribing) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-setup-title"
      >
        <div className={styles.iconWrap}>
          <svg
            width="24"
            height="24"
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
        </div>

        <div className={styles.content}>
          <h2 id="notif-setup-title" className={styles.title}>
            Never miss a dose
          </h2>
          <p className={styles.subtitle}>
            Turn on browser reminders to receive timely notifications when your medicines are due
            or running low.
          </p>
        </div>

        <div className={styles.benefitsList}>
          <div className={styles.benefitItem}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Gentle reminders when doses are due, with snooze and log actions</span>
          </div>
          <div className={styles.benefitItem}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Optional lock-screen privacy to hide medicine names</span>
          </div>
          <div className={styles.benefitItem}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>You can adjust preferences or turn off reminders at any time in Settings</span>
          </div>
        </div>

        {errorMessage && (
          <div className={styles.errorBox} role="alert">
            {errorMessage}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.enableBtn}
            onClick={handleEnable}
            disabled={isSubscribing}
            autoFocus
          >
            {isSubscribing ? 'Enabling…' : 'Enable reminders'}
          </button>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={onClose}
            disabled={isSubscribing}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
