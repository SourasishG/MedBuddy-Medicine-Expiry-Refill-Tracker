'use client';

import { ensureGsapRegistered, gsap, ScrollTrigger } from './gsap';
import {
  defaultSceneTargets,
  sceneTargets,
  setActivePhoneScreen,
  type PhoneScreenId,
} from './sceneState';

const STEP_SCREENS: PhoneScreenId[] = ['cabinet', 'reminder', 'refill', 'family'];

export interface ChoreographyOptions {
  motionEnabled: boolean;
  onStepChange?: (stepIndex: number) => void;
}

export function resetSceneTargets(): void {
  Object.assign(sceneTargets, defaultSceneTargets);
  setActivePhoneScreen('cabinet');
}

export function initScrollChoreography({
  motionEnabled,
  onStepChange,
}: ChoreographyOptions): () => void {
  if (!motionEnabled || typeof window === 'undefined') {
    resetSceneTargets();
    return () => {};
  }

  ensureGsapRegistered();

  const isDesktop = window.matchMedia('(min-width: 960px)').matches;

  const ctx = gsap.context(() => {
    const heroEl = document.getElementById('hero');
    const problemEl = document.getElementById('problem');
    const howEl = document.getElementById('how-it-works');
    const howPinEl = howEl?.querySelector<HTMLElement>('[data-how-pin]');
    const featuresEl = document.getElementById('features');

    // 1. Hero -> 01 Problem: helix loosens and drifts apart, ring dims, phone tilts back
    if (heroEl && problemEl) {
      gsap.to(sceneTargets, {
        phoneX: isDesktop ? 1.55 : 0,
        phoneY: isDesktop ? 0.04 : -0.15,
        phoneZ: -0.45,
        phoneRotX: -0.22,
        phoneRotY: isDesktop ? -0.46 : -0.12,
        phoneRotZ: 0.04,
        phoneScale: isDesktop ? 0.88 : 0.72,
        helixSpread: 0.92,
        ringOpacity: 0.28,
        haloIntensity: 0.45,
        ease: 'none',
        scrollTrigger: {
          trigger: problemEl,
          start: 'top bottom',
          end: 'top 25%',
          scrub: 0.8,
        },
      });

      // Subtle per-statement drift in Problem section
      const statement3 = problemEl.querySelector<HTMLElement>('[data-problem-row="03"]');
      if (statement3) {
        ScrollTrigger.create({
          trigger: statement3,
          start: 'top 65%',
          end: 'bottom 35%',
          onEnter: () => {
            gsap.to(sceneTargets, {
              helixStatusBlend: 0.35,
              duration: 0.6,
              ease: 'power3.out',
            });
          },
          onLeaveBack: () => {
            gsap.to(sceneTargets, {
              helixStatusBlend: 0,
              duration: 0.6,
              ease: 'power3.out',
            });
          },
        });
      }
    }

    // 2. 02 How it works: pinned on desktop, rotates phone, swaps 4 screens, locks 1 pill per step
    if (howEl && howPinEl) {
      let lastStep = -1;

      const updateStep = (progress: number) => {
        const step = Math.min(3, Math.max(0, Math.floor(progress * 3.99)));
        if (step !== lastStep) {
          lastStep = step;
          const screen = STEP_SCREENS[step] ?? 'cabinet';
          setActivePhoneScreen(screen);
          onStepChange?.(step);
        }
      };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: howEl,
          pin: isDesktop ? howPinEl : false,
          start: 'top top',
          end: isDesktop ? '+=2200' : 'bottom center',
          scrub: 0.75,
          anticipatePin: isDesktop ? 1 : 0,
          onUpdate: (self) => {
            updateStep(self.progress);
          },
          onEnter: () => updateStep(0),
        },
      });

      tl.to(sceneTargets, {
        phoneX: isDesktop ? 1.38 : 0,
        phoneY: isDesktop ? 0.06 : 0.1,
        phoneZ: 0.15,
        phoneRotX: 0.04,
        phoneRotY: isDesktop ? -0.26 : -0.1,
        phoneRotZ: -0.02,
        phoneScale: isDesktop ? 0.96 : 0.82,
        helixSpread: 0.18,
        helixStatusBlend: 0.15,
        ringOpacity: 0.68,
        haloIntensity: 0.78,
        lockedPills: 1,
        duration: 0.25,
        ease: 'none',
      })
        .to(sceneTargets, {
          phoneRotY: isDesktop ? 0.16 : 0.12,
          phoneRotX: 0.02,
          lockedPills: 2,
          duration: 0.25,
          ease: 'none',
        })
        .to(sceneTargets, {
          phoneRotY: isDesktop ? -0.28 : -0.14,
          phoneRotX: -0.04,
          lockedPills: 3,
          helixStatusBlend: 0.45,
          duration: 0.25,
          ease: 'none',
        })
        .to(sceneTargets, {
          phoneRotY: isDesktop ? -0.14 : 0,
          phoneRotX: 0.05,
          lockedPills: 4,
          duration: 0.25,
          ease: 'none',
        });
    }

    // 3. 03 Features: UI cards lift off the screen into depth layers around the phone
    if (featuresEl) {
      gsap.to(sceneTargets, {
        phoneX: 0,
        phoneY: isDesktop ? 0.04 : -0.1,
        phoneZ: isDesktop ? -0.85 : -1.1,
        phoneRotX: 0.03,
        phoneRotY: 0,
        phoneRotZ: 0,
        phoneScale: isDesktop ? 0.84 : 0.7,
        helixSpread: 0.45,
        lockedPills: 0,
        tilesLift: 1,
        ringOpacity: 0.55,
        haloIntensity: 0.65,
        ease: 'none',
        scrollTrigger: {
          trigger: featuresEl,
          start: 'top bottom',
          end: 'top 25%',
          scrub: 0.85,
        },
      });
    }
  });

  ScrollTrigger.refresh();

  return () => {
    ctx.revert();
    resetSceneTargets();
  };
}
