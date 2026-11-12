'use client';

import { QRCodeSVG } from 'qrcode.react';
import { PillButton } from '@/components/ui/PillButton';
import type { InstallSituation } from '@/hooks/useInstallPrompt';
import styles from './Install.module.scss';

export interface InstallProps {
  onInstallClick?: () => void;
  installLabel?: string;
  installHref?: string;
  siteUrl?: string;
  justInstalled?: boolean;
  situation?: InstallSituation;
}

export function Install({
  onInstallClick,
  installLabel = 'Install MedBuddy',
  installHref,
  siteUrl = 'https://medbuddy.app',
  justInstalled = false,
  situation = 'desktop-qr',
}: InstallProps) {
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
              {installHref ? (
                <PillButton variant="primary" href={installHref}>
                  {installLabel}
                </PillButton>
              ) : (
                <PillButton variant="primary" onClick={onInstallClick}>
                  {installLabel}
                </PillButton>
              )}
              <span className={styles.platformHint}>
                Android Chrome · iPhone Safari · Desktop QR
              </span>
            </div>

            {justInstalled && (
              <div className={styles.previewBanner} role="status">
                MedBuddy has been added to your device. Open the installed app anytime from your
                home screen or{' '}
                <a href="/app" style={{ textDecoration: 'underline', color: 'var(--ok)' }}>
                  launch the shell now
                </a>
                .
              </div>
            )}
          </div>

          <aside
            className={styles.qrSlot}
            data-platform={situation}
            aria-label="Phone install QR code"
          >
            <div className={styles.qrBox}>
              <QRCodeSVG value={siteUrl} size={124} bgColor="#EAF0F6" fgColor="#090C12" level="M" />
            </div>
            <p className={styles.qrLabel}>Open this on your phone</p>
            <span className={styles.qrMeta}>Scan with camera to install</span>
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
