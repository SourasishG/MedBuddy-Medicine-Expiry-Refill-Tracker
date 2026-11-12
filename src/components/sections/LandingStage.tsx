'use client';

import { useState, type ReactNode } from 'react';
import { SceneLoader } from '@/components/scene/SceneLoader';
import { Hero } from '@/components/sections/Hero';
import { Cursor } from '@/components/ui/Cursor';
import { GrainOverlay } from '@/components/ui/GrainOverlay';
import { Nav } from '@/components/ui/Nav';
import { Preloader } from '@/components/ui/Preloader';
import styles from './LandingStage.module.scss';

export function LandingStage({ children }: { children?: ReactNode }) {
  const [sceneReady, setSceneReady] = useState(false);

  return (
    <div id="top" className={styles.page}>
      <Preloader />
      <SceneLoader onSceneReadyChange={setSceneReady} />
      <GrainOverlay />
      <Cursor />
      <Nav />

      <main id="main-content" className={styles.main}>
        <Hero hasCanvas={sceneReady} />
        {children}
      </main>
    </div>
  );
}
