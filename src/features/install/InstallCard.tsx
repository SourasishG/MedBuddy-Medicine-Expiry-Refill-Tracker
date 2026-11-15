'use client';

import { useState, useEffect } from 'react';
import { getDeviceInstallState, type DeviceInstallState } from '../notifications/push-utils';
import { IosInstallGuideModal } from './IosInstallGuideModal';
import styles from './InstallCard.module.scss';

export function InstallCard() {
  const [deviceState, setDeviceState] = useState<DeviceInstallState>({
    isStandalone: false,
    isIos: false,
    isIosSafari: false,
    isAndroid: false,
    needsIosInstallForPush: false,
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIosModalOpen, setIsIosModalOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const state = getDeviceInstallState();
    setDeviceState(state);
    setIsInstalled(state.isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.iconWrap}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <h3 className={styles.title}>Install MedBuddy App</h3>
          </div>
          {isInstalled && <span className={styles.badge}>Installed</span>}
        </div>

        {isInstalled ? (
          <p className={styles.description}>
            MedBuddy is installed as a progressive web app on this device. You will receive faster
            launching and background dose reminders.
          </p>
        ) : deviceState.isIos ? (
          <>
            <p className={styles.description}>
              Add MedBuddy to your Home Screen to get full-screen app convenience and unlock dose
              reminders on iPhone &amp; iPad.
            </p>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setIsIosModalOpen(true)}
            >
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
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              <span>How to add to Home Screen</span>
            </button>
          </>
        ) : deferredPrompt ? (
          <>
            <p className={styles.description}>
              Install MedBuddy on your device for one-tap access from your home screen and reliable
              scheduled reminders.
            </p>
            <button type="button" className={styles.actionBtn} onClick={handleInstallClick}>
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Install MedBuddy</span>
            </button>
          </>
        ) : (
          <p className={styles.description}>
            To install MedBuddy, tap your browser&apos;s menu (or the install icon in the address bar)
            and select &ldquo;Install MedBuddy&rdquo; or &ldquo;Add to Home screen&rdquo;.
          </p>
        )}
      </div>

      <IosInstallGuideModal isOpen={isIosModalOpen} onClose={() => setIsIosModalOpen(false)} />
    </>
  );
}
