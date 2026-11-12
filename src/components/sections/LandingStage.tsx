'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { initScrollChoreography } from '@/lib/scrollTimeline';
import styles from './LandingStage.module.scss';

export function LandingStage({ children }: { children?: ReactNode }) {
  const [sceneReady, setSceneReady] = useState(false);
  const [howStep, setHowStep] = useState(0);
  const { motionEnabled, isHydrated } = useMotionPreference();

  useEffect(() => {
    if (!isHydrated) return;
    return initScrollChoreography({
      motionEnabled,
      onStepChange: setHowStep,
    });
  }, [isHydrated, motionEnabled]);

  return (
    <div id="top" className={styles.page}>
      <Preloader />
      <SceneLoader onSceneReadyChange={setSceneReady} />
      <GrainOverlay />
      <Cursor />
      <Nav />

      <main id="main-content" className={styles.main}>
        <Hero hasCanvas={sceneReady} />
        <Problem />
        <HowItWorks activeStep={howStep} onSelectStep={setHowStep} />
        <Features />
        <CabinetDemo />
        <Caregivers />
        <Privacy />
        <Faq />
        <Install />
        {children}
      </main>

      <Footer />
    </div>
  );
}
