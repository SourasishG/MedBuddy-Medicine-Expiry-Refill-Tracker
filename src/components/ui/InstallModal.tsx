'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import type { InstallSituation } from '@/hooks/useInstallPrompt';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import styles from './InstallModal.module.scss';

export interface InstallModalProps {
  open: boolean;
  onClose: () => void;
  situation: InstallSituation;
  siteUrl: string;
}

interface GuideStep {
  id: string;
  label: string;
  title: string;
  description: string;
  icon: 'safari' | 'share' | 'plus' | 'add';
}

const IOS_STEPS: GuideStep[] = [
  {
    id: 'share',
    label: 'Step 01',
    title: 'Tap Share',
    description: 'Tap the Share square with the upward arrow at the bottom or top bar of Safari.',
    icon: 'share',
  },
  {
    id: 'add-home',
    label: 'Step 02',
    title: 'Tap Add to Home Screen',
    description: 'Scroll the Share menu down and choose Add to Home Screen.',
    icon: 'plus',
  },
  {
    id: 'confirm',
    label: 'Step 03',
    title: 'Tap Add',
    description: 'Tap Add in the top corner. MedBuddy appears on your home screen right away.',
    icon: 'add',
  },
];

function StepIcon({
  icon,
  active,
  motionEnabled,
}: {
  icon: GuideStep['icon'];
  active: boolean;
  motionEnabled: boolean;
}) {
  const animateProps = motionEnabled && active ? { y: [0, -3, 0] } : undefined;
  return (
    <m.div
      className={styles.stepIconBox}
      animate={animateProps}
      transition={{
        duration: 0.9,
        repeat: motionEnabled && active ? Infinity : 0,
        repeatDelay: 0.6,
      }}
      aria-hidden="true"
    >
      {icon === 'safari' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <polygon points="10,10 15.5,8.5 14,14 8.5,15.5" fill="currentColor" />
        </svg>
      )}
      {icon === 'share' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3v12M7.5 7.5 12 3l4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
      {icon === 'plus' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      {icon === 'add' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5 9.5 17 19 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </m.div>
  );
}

export function InstallModal({ open, onClose, situation, siteUrl }: InstallModalProps) {
  const { motionEnabled } = useMotionPreference();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const isIosGuide = situation === 'ios-safari' || situation === 'ios-non-safari';
  const steps: GuideStep[] =
    situation === 'ios-non-safari'
      ? [
          {
            id: 'open-safari',
            label: 'First step',
            title: 'Open this page in Safari',
            description:
              'Apple only allows adding web apps to your home screen from Safari. Copy the link below and open it in Safari.',
            icon: 'safari',
          },
          ...IOS_STEPS,
        ]
      : IOS_STEPS;

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 30);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !isIosGuide || !motionEnabled) return;
    const timer = window.setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % steps.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [open, isIosGuide, motionEnabled, steps.length]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in non-HTTPS contexts
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className={styles.backdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          initial={motionEnabled ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={motionEnabled ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: motionEnabled ? 0.25 : 0.001 }}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-modal-title"
            className={styles.dialog}
            initial={motionEnabled ? { y: 18, opacity: 0, scale: 0.98 } : false}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={motionEnabled ? { y: 12, opacity: 0 } : { opacity: 0 }}
            transition={{ duration: motionEnabled ? 0.35 : 0.001, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.topRow}>
              <span className={styles.mono}>
                {isIosGuide
                  ? 'IPHONE & IPAD INSTALL GUIDE'
                  : situation === 'desktop-qr'
                    ? 'OPEN ON YOUR PHONE'
                    : 'HOW TO INSTALL MEDBUDDY'}
              </span>
              <button ref={closeBtnRef} type="button" className={styles.closeBtn} onClick={onClose}>
                Close
              </button>
            </div>

            {isIosGuide && (
              <>
                <div>
                  <h2 id="install-modal-title" className={styles.title}>
                    Add MedBuddy to your <em>Home Screen.</em>
                  </h2>
                  <p className={styles.subtitle}>
                    Follow these steps in Safari. Early installers get the web shell now and receive
                    updates when the app launches.
                  </p>
                </div>

                <div className={styles.stepsList}>
                  {steps.map((step, index) => (
                    <button
                      key={step.id}
                      type="button"
                      className={styles.stepCard}
                      data-active={index === activeStepIndex}
                      onClick={() => setActiveStepIndex(index)}
                    >
                      <StepIcon
                        icon={step.icon}
                        active={index === activeStepIndex}
                        motionEnabled={motionEnabled}
                      />
                      <div className={styles.stepContent}>
                        <span className={styles.stepNum}>{step.label}</span>
                        <span className={styles.stepTitle}>{step.title}</span>
                        <span className={styles.stepDesc}>{step.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {situation === 'desktop-qr' && (
              <>
                <div>
                  <h2 id="install-modal-title" className={styles.title}>
                    Open this on your <em>phone.</em>
                  </h2>
                  <p className={styles.subtitle}>
                    Scan this code with your phone camera to open MedBuddy on Android or iPhone and
                    add it to your home screen.
                  </p>
                </div>

                <div className={styles.qrPanel}>
                  <div className={styles.qrFrame}>
                    <QRCodeSVG
                      value={siteUrl}
                      size={180}
                      bgColor="#EAF0F6"
                      fgColor="#090C12"
                      level="M"
                      title="QR code to open MedBuddy on your phone"
                    />
                  </div>
                  <span className={styles.qrUrl}>{siteUrl}</span>
                </div>
              </>
            )}

            {(situation === 'unsupported' || situation === 'prompt-available') && (
              <>
                <div>
                  <h2 id="install-modal-title" className={styles.title}>
                    Install from your <em>mobile browser.</em>
                  </h2>
                  <p className={styles.subtitle}>
                    {situation === 'prompt-available'
                      ? 'You can install MedBuddy from your browser menu, or scan the link on your phone.'
                      : 'Your current browser does not offer one-tap installation directly.'}
                  </p>
                </div>

                <div className={styles.stepsList}>
                  <div className={styles.stepCard} data-active="true">
                    <div className={styles.stepContent}>
                      <span className={styles.stepNum}>On Android</span>
                      <span className={styles.stepTitle}>Use Chrome or Microsoft Edge</span>
                      <span className={styles.stepDesc}>
                        Open this link in Chrome or Edge, then tap the browser menu and select
                        Install app or Add to Home screen.
                      </span>
                    </div>
                  </div>
                  <div className={styles.stepCard}>
                    <div className={styles.stepContent}>
                      <span className={styles.stepNum}>On iPhone or iPad</span>
                      <span className={styles.stepTitle}>Use Safari</span>
                      <span className={styles.stepDesc}>
                        Open this link in Safari, tap Share, then choose Add to Home Screen.
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className={styles.actionsRow}>
              <button type="button" className={styles.copyBtn} onClick={handleCopyUrl}>
                {copied ? 'Link copied' : 'Copy page link'}
              </button>
              <span className={styles.qrUrl}>Early-access PWA shell</span>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
