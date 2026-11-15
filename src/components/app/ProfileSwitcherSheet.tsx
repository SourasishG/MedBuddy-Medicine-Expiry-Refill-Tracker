'use client';

import { useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import styles from './AppShell.module.scss';

export function ProfileSwitcherSheet() {
  const {
    careProfiles,
    activeCareProfile,
    setActiveProfileId,
    isSwitcherOpen,
    setSwitcherOpen,
  } = useCareProfile();
  const { motionEnabled } = useMotionPreference();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap / escape key listener
  useEffect(() => {
    if (!isSwitcherOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSwitcherOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Auto focus close button on open
    closeBtnRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSwitcherOpen, setSwitcherOpen]);

  const duration = motionEnabled ? 0.25 : 0;

  return (
    <AnimatePresence>
      {isSwitcherOpen && (
        <div className={styles.sheetBackdrop} onClick={() => setSwitcherOpen(false)}>
          <m.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-switcher-title"
            className={styles.sheetContainer}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%', opacity: motionEnabled ? 0.6 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: motionEnabled ? 0.6 : 1 }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.sheetHandle} aria-hidden="true" />

            <div className={styles.sheetHeader}>
              <h2 id="profile-switcher-title" className={styles.sheetTitle}>
                Care Profiles
              </h2>
              <button
                ref={closeBtnRef}
                type="button"
                className={styles.sheetCloseBtn}
                onClick={() => setSwitcherOpen(false)}
                aria-label="Close profile switcher"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.profileList} role="radiogroup" aria-label="Select active care profile">
              {careProfiles.map((profile) => {
                const isActive = profile.id === activeCareProfile?.id;
                const initial = (profile.name || 'P').charAt(0).toUpperCase();

                return (
                  <button
                    key={profile.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={styles.profileOption}
                    data-active={isActive}
                    onClick={() => {
                      setActiveProfileId(profile.id);
                      setSwitcherOpen(false);
                    }}
                  >
                    <div className={styles.profileOptionLeft}>
                      <span className={styles.avatarInitial} aria-hidden="true">
                        {initial}
                      </span>
                      <div>
                        <div className={styles.profileOptionName}>{profile.name}</div>
                        <div className={styles.profileOptionRole}>
                          {profile.role || 'owner'} · {profile.timezone}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <svg
                        className={styles.profileCheckIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-label="Active"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <Link
              href="/app/setup?mode=new"
              className={styles.sheetAddBtn}
              onClick={() => setSwitcherOpen(false)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add another care profile</span>
            </Link>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
