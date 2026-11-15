'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './DeleteAccountModal.module.scss';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [confirmationWord, setConfirmationWord] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeletedSuccess, setIsDeletedSuccess] = useState(false);

  const handleClose = () => {
    setConfirmationWord('');
    setErrorMessage(null);
    setIsDeletedSuccess(false);
    setIsDeleting(false);
    onClose();
  };

  if (!isOpen) return null;

  const isConfirmed = confirmationWord.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.rpc('fn_delete_my_data');

      if (error) {
        setErrorMessage(
          error.message.includes('co-owner')
            ? 'You are an owner of a shared profile. Please transfer ownership or remove other members before deleting your account.'
            : `Could not delete account: ${error.message}`,
        );
        setIsDeleting(false);
        return;
      }

      // Sign out and clear all local credentials
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore signout errors on deleted account
      }

      if (typeof document !== 'undefined') {
        document.cookie = 'medbuddy_app_state=; path=/app; max-age=0';
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('medbuddy-active-care-profile');
      }

      setIsDeletedSuccess(true);
    } catch {
      setErrorMessage('A network error occurred while deleting your account. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleReturnHome = () => {
    router.replace('/');
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting && !isDeletedSuccess) {
          handleClose();
        }
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
      >
        {isDeletedSuccess ? (
          <>
            <div className={styles.successIconWrap}>
              <svg
                width="28"
                height="28"
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
            </div>
            <div className={styles.header}>
              <span
                className={styles.badge}
                style={{
                  color: 'var(--ok)',
                  borderColor: 'rgba(92, 242, 199, 0.3)',
                  background: 'rgba(92, 242, 199, 0.12)',
                }}
              >
                Account Erased
              </span>
              <h2 id="delete-account-title" className={styles.title}>
                Account &amp; Data Permanently Deleted
              </h2>
            </div>
            <p className={styles.confirmPrompt}>
              Your account, profile information, medication cabinets, dose schedules, and entire
              adherence history have been completely deleted from our database.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.homeBtn} onClick={handleReturnHome} autoFocus>
                Return to homepage
              </button>
            </div>
          </>
        ) : (
          <>
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
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>

            <div className={styles.header}>
              <span className={styles.badge}>Irreversible Action</span>
              <h2 id="delete-account-title" className={styles.title}>
                Delete account and all data?
              </h2>
            </div>

            <div className={styles.warningBox}>
              <div className={styles.warningHeading}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>What will be erased:</span>
              </div>
              <ul className={styles.warningList}>
                <li>All care profiles you created and manage.</li>
                <li>Every medication, box, batch number, and storage record.</li>
                <li>Your complete schedule and dose adherence history.</li>
                <li>All notification logs and push subscriptions.</li>
                <li>Your account credentials and sign-in identity.</li>
              </ul>
            </div>

            <p className={styles.confirmPrompt}>
              To confirm you want to permanently delete your account, type <strong>DELETE</strong>{' '}
              below:
            </p>

            <div className={styles.inputGroup}>
              <label htmlFor="confirm-delete-input" className={styles.label}>
                Confirmation phrase
              </label>
              <input
                id="confirm-delete-input"
                type="text"
                className={styles.input}
                placeholder="Type DELETE"
                value={confirmationWord}
                onChange={(e) => setConfirmationWord(e.target.value)}
                autoComplete="off"
                disabled={isDeleting}
                autoFocus
              />
            </div>

            {errorMessage && (
              <div className={styles.errorBox} role="alert">
                {errorMessage}
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={handleDelete}
                disabled={!isConfirmed || isDeleting}
              >
                {isDeleting ? 'Deleting everything…' : 'Permanently delete account'}
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleClose}
                disabled={isDeleting}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
