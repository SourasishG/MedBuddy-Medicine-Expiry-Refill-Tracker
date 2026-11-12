'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { MotionToggle } from './MotionToggle';
import { PillButton } from './PillButton';
import styles from './Nav.module.scss';

const NAV_LINKS = [
  { href: '#problem', label: 'Problem' },
  { href: '#features', label: 'Features' },
  { href: '#family', label: 'Family' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#faq', label: 'FAQ' },
] as const;

export interface NavProps {
  onInstallClick?: () => void;
  installLabel?: string;
  installHref?: string;
}

export function Nav({ onInstallClick, installLabel = 'Install', installHref }: NavProps) {
  const [showInstall, setShowInstall] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const { motionEnabled } = useMotionPreference();

  useEffect(() => {
    const heroEl = document.getElementById('hero');
    if (!heroEl) {
      const onScroll = () => setShowInstall(window.scrollY > window.innerHeight * 0.65);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setShowInstall(!entry.isIntersecting);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <a href="#top" className={styles.wordmark} data-cursor="interactive">
            MEDBUDDY
          </a>

          <nav className={styles.desktopNav} aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <a key={item.href} href={item.href} className={styles.link} data-cursor="interactive">
                {item.label}
              </a>
            ))}
          </nav>

          <div className={styles.actions}>
            <div className={styles.installSlot} data-visible={showInstall}>
              {installHref ? (
                <PillButton
                  variant="primary"
                  size="sm"
                  href={installHref}
                  tabIndex={showInstall ? 0 : -1}
                  aria-hidden={!showInstall}
                >
                  {installLabel}
                </PillButton>
              ) : onInstallClick ? (
                <PillButton
                  variant="primary"
                  size="sm"
                  onClick={onInstallClick}
                  tabIndex={showInstall ? 0 : -1}
                  aria-hidden={!showInstall}
                >
                  {installLabel}
                </PillButton>
              ) : (
                <PillButton
                  variant="primary"
                  size="sm"
                  href="#install"
                  tabIndex={showInstall ? 0 : -1}
                  aria-hidden={!showInstall}
                >
                  {installLabel}
                </PillButton>
              )}
            </div>

            <MotionToggle />

            <button
              ref={menuBtnRef}
              type="button"
              className={styles.menuButton}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <m.div
            id="mobile-nav-drawer"
            className={styles.drawerBackdrop}
            initial={motionEnabled ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={motionEnabled ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: motionEnabled ? 0.25 : 0.001 }}
          >
            <m.nav
              className={styles.drawer}
              aria-label="Mobile navigation"
              initial={motionEnabled ? { y: -16, opacity: 0 } : false}
              animate={{ y: 0, opacity: 1 }}
              exit={motionEnabled ? { y: -12, opacity: 0 } : { opacity: 0 }}
              transition={{ duration: motionEnabled ? 0.35 : 0.001, ease: [0.22, 1, 0.36, 1] }}
            >
              <ul className={styles.drawerList}>
                {NAV_LINKS.map((item, idx) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={styles.drawerLink}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className={styles.drawerIndex}>0{idx + 1}</span>
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className={styles.drawerFooter}>
                {installHref ? (
                  <PillButton
                    variant="primary"
                    href={installHref}
                    onClick={() => setMenuOpen(false)}
                  >
                    {installLabel === 'Install' ? 'Install MedBuddy' : installLabel}
                  </PillButton>
                ) : onInstallClick ? (
                  <PillButton
                    variant="primary"
                    onClick={() => {
                      setMenuOpen(false);
                      onInstallClick();
                    }}
                  >
                    {installLabel === 'Install' ? 'Install MedBuddy' : installLabel}
                  </PillButton>
                ) : (
                  <PillButton variant="primary" href="#install" onClick={() => setMenuOpen(false)}>
                    Install MedBuddy
                  </PillButton>
                )}
              </div>
            </m.nav>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
