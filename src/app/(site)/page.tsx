import { LandingStage } from '@/components/sections/LandingStage';
import styles from './page.module.scss';

export default function LandingPage() {
  return (
    <LandingStage>
      <section
        id="how-it-works"
        className={styles.placeholderSection}
        aria-label="Upcoming sections"
      >
        <div className={styles.placeholderInner}>
          <p className={styles.mono}>PHASE 02 / 3D SCENE STAGE</p>
          <p className={styles.copy}>
            Sections 01 through 08 and the scrubbed ScrollTrigger timeline will wire into this
            persistent 3D stage in Phases 3 and 4.
          </p>
        </div>
      </section>

      <div id="install" aria-hidden="true" />
    </LandingStage>
  );
}
