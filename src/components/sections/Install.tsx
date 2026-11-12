'use client';

import { useState } from 'react';
import { PillButton } from '@/components/ui/PillButton';
import styles from './Install.module.scss';

export interface InstallProps {
  onInstallClick?: () => void;
  qrSlotContent?: React.ReactNode;
}

export function Install({ onInstallClick, qrSlotContent }: InstallProps) {
  const [previewNoticeOpen, setPreviewNoticeOpen] = useState(false);

  const handleInstallPress = () => {
    if (onInstallClick) {
      onInstallClick();
    } else {
      setPreviewNoticeOpen((prev) => !prev);
    }
  };

  return (
    <section id="install" className={styles.section} aria-labelledby="install-heading">
      <div className={styles.wordmarkStage}>
        <div className={styles.giantWordmark} aria-hidden="true">
          MEDBUDDY
        </div>
        <div className={styles.stageSpacer} aria-hidden="true" />
      </div>

      <div className={styles.panelWrap}>
        <div className={styles.panel}>
          <div className={styles.panelCopy}>
            <span className={styles.monoLabel}>08 / INSTALL EARLY ACCESS</span>
            <h2 id="install-heading" className={styles.title}>
              Put MedBuddy on your home screen <em>today.</em>
            </h2>
            <p className={styles.lead}>
              Install straight from this page on Android or iPhone. Early installers get the
              lightweight web shell now and update automatically as soon as the app launches.
            </p>

            <div className={styles.ctaRow}>
              <PillButton variant="primary" onClick={handleInstallPress}>
                Install MedBuddy
              </PillButton>
              <span className={styles.platformHint}>
                Android Chrome · iPhone Safari · Desktop QR
              </span>
            </div>

            {previewNoticeOpen && (
              <div className={styles.previewBanner} role="status">
                Phase 5 wires the live browser install prompt, iOS Add to Home Screen guide, offline
                service worker, and launching-soon `/app` shell to this button.
              </div>
            )}
          </div>

          <aside className={styles.qrSlot} aria-label="Phone install QR preview">
            {qrSlotContent ?? (
              <div className={styles.qrBox} aria-label="QR code slot for desktop">
                <svg width="108" height="108" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                  <rect
                    x="2"
                    y="2"
                    width="10"
                    height="10"
                    rx="1.5"
                    stroke="#090C12"
                    strokeWidth="2.4"
                  />
                  <rect x="5" y="5" width="4" height="4" fill="#090C12" />
                  <rect
                    x="24"
                    y="2"
                    width="10"
                    height="10"
                    rx="1.5"
                    stroke="#090C12"
                    strokeWidth="2.4"
                  />
                  <rect x="27" y="5" width="4" height="4" fill="#090C12" />
                  <rect
                    x="2"
                    y="24"
                    width="10"
                    height="10"
                    rx="1.5"
                    stroke="#090C12"
                    strokeWidth="2.4"
                  />
                  <rect x="5" y="27" width="4" height="4" fill="#090C12" />
                  <rect x="16" y="4" width="4" height="4" fill="#090C12" />
                  <rect x="16" y="12" width="4" height="4" fill="#090C12" />
                  <rect x="4" y="16" width="4" height="4" fill="#090C12" />
                  <rect x="12" y="18" width="6" height="4" fill="#090C12" />
                  <rect x="22" y="16" width="4" height="6" fill="#090C12" />
                  <rect x="28" y="18" width="4" height="4" fill="#090C12" />
                  <rect x="18" y="26" width="6" height="4" fill="#090C12" />
                  <rect x="28" y="28" width="4" height="4" fill="#090C12" />
                </svg>
              </div>
            )}
            <p className={styles.qrLabel}>Open this on your phone</p>
            <span className={styles.qrMeta}>Live URL QR wired in Phase 5</span>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <a href="#top" className={styles.footerBrand}>
          MEDBUDDY
        </a>

        <nav className={styles.footerNav} aria-label="Footer navigation">
          <a href="#problem" className={styles.footerLink}>
            Problem
          </a>
          <a href="#how-it-works" className={styles.footerLink}>
            How it works
          </a>
          <a href="#features" className={styles.footerLink}>
            Features
          </a>
          <a href="#cabinet-demo" className={styles.footerLink}>
            Live demo
          </a>
          <a href="#family" className={styles.footerLink}>
            Family
          </a>
          <a href="#privacy" className={styles.footerLink}>
            Privacy
          </a>
          <a href="#faq" className={styles.footerLink}>
            FAQ
          </a>
        </nav>
      </div>

      <p className={styles.disclaimer}>
        MedBuddy is a reminder and tracking tool. It does not provide medical advice, diagnosis or
        treatment. Always follow your doctor’s instructions.
      </p>

      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} MedBuddy · Early-access site</span>
        <div className={styles.legalLinks}>
          <a href="#privacy">Privacy notice (placeholder)</a>
          <span>hello@medbuddy.example (placeholder)</span>
        </div>
      </div>
    </footer>
  );
}
