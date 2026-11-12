'use client';

import Lenis from 'lenis';
import { loadGsapPlugins } from './gsap';

export interface LenisController {
  lenis: Lenis;
  destroy: () => void;
}

export async function createLenisController(): Promise<LenisController> {
  const { gsap, ScrollTrigger } = await loadGsapPlugins();

  const lenis = new Lenis({
    lerp: 0.085,
    smoothWheel: true,
    wheelMultiplier: 0.92,
    anchors: { offset: -72 },
  });

  const onScroll = () => {
    ScrollTrigger.update();
  };

  const onTick = (time: number) => {
    lenis.raf(time * 1000);
  };

  lenis.on('scroll', onScroll);
  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);

  return {
    lenis,
    destroy: () => {
      lenis.off('scroll', onScroll);
      gsap.ticker.remove(onTick);
      lenis.destroy();
    },
  };
}
