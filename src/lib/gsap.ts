'use client';

import gsap from 'gsap';

let coreConfigured = false;
let pluginsRegistered = false;

export function ensureGsapRegistered(): void {
  if (coreConfigured || typeof window === 'undefined') return;
  gsap.defaults({
    ease: 'power3.out',
    duration: 1,
  });
  coreConfigured = true;
}

export async function loadGsapPlugins() {
  ensureGsapRegistered();
  const [{ ScrollTrigger }, { SplitText }] = await Promise.all([
    import('gsap/ScrollTrigger'),
    import('gsap/SplitText'),
  ]);
  if (!pluginsRegistered && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    pluginsRegistered = true;
  }
  return { gsap, ScrollTrigger, SplitText };
}

export { gsap };
