'use client';

import { useEffect, useRef } from 'react';
import styles from './IosInstallGuideModal.module.scss';

interface IosInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IosInstallGuideModal({ isOpen, onClose }: IosInstallGuideModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-guide-title"
      >
        <div className={styles.header}>
          <span className={styles.badge}>iPhone & iPad</span>
          <h2 id="ios-guide-title" className={styles.title}>
            Add MedBuddy to Home Screen
          </h2>
          <p className={styles.subtitle}>
            On iOS, web reminders only work once MedBuddy is installed to your home screen. Follow
            these 3 quick steps in Safari:
          </p>
        </div>

        <div className={styles.stepsList}>
          {/* Step 1 */}
          <div className={styles.stepItem}>
            <span className={styles.stepNumber}>1</span>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>
                <span>Tap the Share button</span>
                <svg
                  className={styles.stepIcon}
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
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </div>
              <div className={styles.stepDesc}>
                Look for the Share icon at the bottom of Safari (or top-right on iPad).
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className={styles.stepItem}>
            <span className={styles.stepNumber}>2</span>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>
                <span>Choose &ldquo;Add to Home Screen&rdquo;</span>
                <svg
                  className={styles.stepIcon}
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
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <div className={styles.stepDesc}>
                Scroll down the share sheet and tap <strong>Add to Home Screen</strong>.
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className={styles.stepItem}>
            <span className={styles.stepNumber}>3</span>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>
                <span>Tap &ldquo;Add&rdquo; in the top right</span>
                <svg
                  className={styles.stepIcon}
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
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className={styles.stepDesc}>
                Tap Add in the top-right corner. MedBuddy will appear on your home screen. Open it
                from there to enable dose reminders!
              </div>
            </div>
          </div>
        </div>

        <div className={styles.appleNote}>
          <strong>Why this is needed:</strong> Apple requires web applications on iOS 16.4+ to run
          from the Home Screen before granting notification permissions.
        </div>

        <button type="button" className={styles.closeBtn} onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
}
