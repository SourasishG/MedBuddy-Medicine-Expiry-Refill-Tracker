import { LandingStage } from '@/components/sections/LandingStage';
import styles from './page.module.scss';

export default function LandingPage() {
  return (
    <LandingStage>
      <section
        id="family"
        className={styles.placeholderSection}
        aria-label="Upcoming sections 04 through 08"
      >
        <div className={styles.placeholderInner}>
          <p className={styles.mono}>PHASE 03 / SECTIONS 01–03 &amp; CHOREOGRAPHY COMPLETE</p>
          <p className={styles.copy}>
            Sections 04 through 08 (Live Cabinet Demo, Caregiver Thread, Privacy Spec Sheet, FAQ,
            Install Panel, and Footer) will be added in Phase 4.
          </p>
        </div>
      </section>

      <div id="privacy" aria-hidden="true" />
      <div id="faq" aria-hidden="true" />
      <div id="install" aria-hidden="true" />
    </LandingStage>
  );
}
