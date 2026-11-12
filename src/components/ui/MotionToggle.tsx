'use client';

import { useMotionPreference } from '@/hooks/useMotionPreference';
import styles from './MotionToggle.module.scss';

export function MotionToggle() {
  const { motionEnabled, isHydrated, toggleMotion } = useMotionPreference();
  const label = isHydrated ? (motionEnabled ? 'On' : 'Off') : 'On';

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleMotion}
      aria-pressed={isHydrated ? motionEnabled : true}
      title="Toggle animations and smooth scrolling"
      data-enabled={isHydrated ? motionEnabled : true}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>Motion</span> <span className={styles.state}>{label}</span>
    </button>
  );
}
