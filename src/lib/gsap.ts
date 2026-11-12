'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

let registered = false;

export function ensureGsapRegistered(): void {
  if (registered || typeof window === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({
    ease: 'power3.out',
    duration: 1,
  });
  registered = true;
}

export { gsap, ScrollTrigger, SplitText };
