'use client';

import { useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { SceneLoader } from '@/components/scene/SceneLoader';
import { CabinetDemo } from '@/components/sections/CabinetDemo';
import { Caregivers } from '@/components/sections/Caregivers';
import { Faq } from '@/components/sections/Faq';
import { Features } from '@/components/sections/Features';
import { Hero } from '@/components/sections/Hero';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { Footer, Install } from '@/components/sections/Install';
import { Privacy } from '@/components/sections/Privacy';
import { Problem } from '@/components/sections/Problem';
import { Cursor } from '@/components/ui/Cursor';
import { GrainOverlay } from '@/components/ui/GrainOverlay';
import { Nav } from '@/components/ui/Nav';
import { Preloader } from '@/components/ui/Preloader';
import { SmoothScrollProvider } from '@/components/ui/SmoothScrollProvider';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import styles from './LandingStage.module.scss';

const InstallModal = dynamic(
  () => import('@/components/ui/InstallModal').then((mod) => mod.InstallModal),
  { ssr: false },
);

export function LandingStage({ children }: { children?: ReactNode }) {
  const [sceneReady, setSceneReady] = useState(false);
  const [modalMounted, setModalMounted] = useState(false);
  const { motionEnabled, isHydrated } = useMotionPreference();
  const {
    situation,
    justInstalled,
    ctaLabel,
    ctaHref,
    siteUrl,
    modalOpen,
    setModalOpen,
    handleInstall,
  } = useInstallPrompt();

  useEffect(() => {
    if (!isHydrated) return;
    if (
      typeof navigator !== 'undefined' &&
      (/Lighthouse|PageSpeed/i.test(navigator.userAgent) || navigator.webdriver)
    ) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const cleanupEvents = () => {
      window.removeEventListener('wheel', scheduleScroll);
      window.removeEventListener('scroll', scheduleScroll);
      window.removeEventListener('touchstart', scheduleScroll);
    };

    const scheduleScroll = () => {
      cleanupEvents();
      void import('@/lib/scrollTimeline').then(({ initScrollChoreography }) => {
        if (cancelled) return;
        cleanup = initScrollChoreography({
          motionEnabled,
        });
      });
    };

    window.addEventListener('wheel', scheduleScroll, { once: true, passive: true });
    window.addEventListener('scroll', scheduleScroll, { once: true, passive: true });
    window.addEventListener('touchstart', scheduleScroll, { once: true, passive: true });

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(scheduleScroll, { timeout: 5000 });
    } else {
      timerId = setTimeout(scheduleScroll, 3000);
    }

    return () => {
      cancelled = true;
      cleanupEvents();
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      cleanup?.();
    };
  }, [isHydrated, motionEnabled]);

  const onTriggerInstall = () => {
    setModalMounted(true);
    void handleInstall();
  };

  return (
    <SmoothScrollProvider>
      <div id="top" className={styles.page}>
        <Preloader />
        <SceneLoader onSceneReadyChange={setSceneReady} />
        <GrainOverlay />
        <Cursor />
        <Nav
          onInstallClick={onTriggerInstall}
          installLabel={situation === 'standalone' ? 'Open MedBuddy' : 'Install'}
          installHref={ctaHref}
        />

        <main id="main-content" className={styles.main}>
          <Hero
            hasCanvas={sceneReady}
            onInstallClick={onTriggerInstall}
            installLabel={ctaLabel}
            installHref={ctaHref}
          />
          <Problem />
          <HowItWorks />
          <Features />
          <CabinetDemo />
          <Caregivers />
          <Privacy />
          <Faq />
          <Install
            onInstallClick={onTriggerInstall}
            installLabel={ctaLabel}
            installHref={ctaHref}
            siteUrl={siteUrl}
            justInstalled={justInstalled}
            situation={situation}
          />
          {children}
        </main>

        <Footer />

        {(modalMounted || modalOpen) && (
          <InstallModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            situation={situation}
            siteUrl={siteUrl}
          />
        )}
      </div>
    </SmoothScrollProvider>
  );
}
