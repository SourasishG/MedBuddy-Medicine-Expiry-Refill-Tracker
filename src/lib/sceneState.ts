export type PhoneScreenId = 'cabinet' | 'reminder' | 'refill' | 'family';

export interface SceneTargets {
  phoneX: number;
  phoneY: number;
  phoneZ: number;
  phoneRotX: number;
  phoneRotY: number;
  phoneRotZ: number;
  phoneScale: number;
  helixSpread: number;
  helixRingMode: number; // 0 = double helix, 1 = reformed ring around phone
  helixStatusBlend: number; // 0 = chrome/glass gallery, 1 = status tinted (ok/warn/alert)
  ringOpacity: number;
  ringScale: number;
  haloIntensity: number;
  tilesLift: number; // 0 = orbiting gently, 1 = lifted out into feature layers
  glitchPulse: number; // 0..1 brief <300ms transition pulse
  sceneOpacity: number;
}

export const defaultSceneTargets: SceneTargets = {
  phoneX: 0,
  phoneY: 0.08,
  phoneZ: 0,
  phoneRotX: 0.06,
  phoneRotY: -0.18,
  phoneRotZ: -0.04,
  phoneScale: 1,
  helixSpread: 0,
  helixRingMode: 0,
  helixStatusBlend: 0,
  ringOpacity: 0.9,
  ringScale: 1,
  haloIntensity: 1,
  tilesLift: 0,
  glitchPulse: 0,
  sceneOpacity: 1,
};

// Mutable runtime targets mutated by GSAP ScrollTrigger & read in R3F useFrame at 60fps
export const sceneTargets: SceneTargets = { ...defaultSceneTargets };

type ScreenListener = (screen: PhoneScreenId) => void;
let currentScreen: PhoneScreenId = 'cabinet';
const listeners = new Set<ScreenListener>();

export function getActivePhoneScreen(): PhoneScreenId {
  return currentScreen;
}

export function setActivePhoneScreen(next: PhoneScreenId): void {
  if (currentScreen === next) return;
  currentScreen = next;
  listeners.forEach((cb) => cb(next));
}

export function subscribePhoneScreen(listener: ScreenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
