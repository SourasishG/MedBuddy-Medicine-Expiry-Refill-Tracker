'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { QualityTier } from '@/hooks/useGpuTier';
import { Effects } from './Effects';
import { FloatingTiles } from './FloatingTiles';
import { Phone } from './Phone';
import { PillHelix } from './PillHelix';
import { RingHalo } from './RingHalo';
import styles from './Scene.module.scss';

export interface SceneProps {
  initialTier: Exclude<QualityTier, 'low'>;
  isMobile: boolean;
  onReady?: () => void;
  onFallbackToPoster?: () => void;
}

export default function Scene({ initialTier, isMobile, onReady, onFallbackToPoster }: SceneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<QualityTier>(initialTier);
  const [bloomEnabled, setBloomEnabled] = useState(initialTier === 'high');
  const [useBakedScreen, setUseBakedScreen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isTabActive, setIsTabActive] = useState(true);
  const declineCountRef = useRef(0);

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsTabActive(!document.hidden);
    };
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleDecline = useCallback(() => {
    declineCountRef.current += 1;
    if (declineCountRef.current === 1) {
      setBloomEnabled(false);
      setTier('medium');
    } else if (declineCountRef.current >= 2) {
      setUseBakedScreen(true);
    }
  }, []);

  const handleFallback = useCallback(() => {
    setBloomEnabled(false);
    setTier('medium');
    setUseBakedScreen(true);
  }, []);

  const isActive = isVisible && isTabActive;
  const dpr: [number, number] = isMobile ? [1, 1.25] : [1, 1.75];

  return (
    <div
      ref={wrapperRef}
      className={styles.canvasWrap}
      aria-hidden="true"
      data-tier={tier}
      data-baked={useBakedScreen}
    >
      <Canvas
        dpr={dpr}
        frameloop={isActive ? 'always' : 'never'}
        camera={{
          position: [0, 0.18, isMobile ? 8.8 : 7.3],
          fov: 35,
          near: 0.1,
          far: 40,
        }}
        gl={{
          antialias: tier === 'high',
          powerPreference: 'high-performance',
          alpha: false,
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            'webglcontextlost',
            (e) => {
              e.preventDefault();
              onFallbackToPoster?.();
            },
            { once: true },
          );
          onReady?.();
        }}
      >
        <color attach="background" args={['#090C12']} />

        <PerformanceMonitor
          ms={250}
          iterations={6}
          onDecline={handleDecline}
          onFallback={handleFallback}
        />

        <Effects tier={tier} isMobile={isMobile} bloomEnabled={bloomEnabled} />
        <RingHalo isMobile={isMobile} />
        <PillHelix tier={tier} isMobile={isMobile} />
        <FloatingTiles isMobile={isMobile} />
        <Phone useBakedScreen={useBakedScreen} isMobile={isMobile} />
      </Canvas>
    </div>
  );
}
