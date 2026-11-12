import { Hero } from '@/components/sections/Hero';
import { Cursor } from '@/components/ui/Cursor';
import { GrainOverlay } from '@/components/ui/GrainOverlay';
import { Nav } from '@/components/ui/Nav';
import { Preloader } from '@/components/ui/Preloader';
import styles from './page.module.scss';

export default function LandingPage() {
  return (
    <div id="top" className={styles.page}>
      <Preloader />
      <GrainOverlay />
      <Cursor />
      <Nav />

      <main id="main-content">
        <Hero />

        <section
          id="how-it-works"
          className={styles.placeholderSection}
          aria-label="Upcoming sections"
        >
          <div className={styles.placeholderInner}>
            <p className={styles.mono}>PHASE 01 / HERO STAGE COMPLETE</p>
            <p className={styles.copy}>
              Sections 01 through 08 and the interactive 3D phone and pill helix scene will connect
              directly below this hero stage in Phases 2 through 4.
            </p>
          </div>
        </section>

        <div id="install" aria-hidden="true" />
      </main>
    </div>
  );
}
