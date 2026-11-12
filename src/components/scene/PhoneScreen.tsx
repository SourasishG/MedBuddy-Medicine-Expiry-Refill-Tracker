'use client';

import type { PhoneScreenId } from '@/lib/sceneState';
import styles from './PhoneScreen.module.scss';

export function PhoneScreen({ screen = 'cabinet' }: { screen?: PhoneScreenId }) {
  return (
    <div className={styles.screen} data-screen={screen}>
      <div className={styles.dynamicIsland} />

      <div className={styles.topMeta}>
        <span className={styles.appLabel}>MEDBUDDY</span>
        <span className={styles.illustrative}>Illustrative</span>
      </div>

      {screen === 'cabinet' && (
        <div className={styles.body}>
          <div className={styles.heading}>Home Cabinet</div>
          <div className={styles.sub}>Sorted by expiry &amp; opened date</div>

          <div className={styles.chips}>
            <span className={`${styles.chip} ${styles.ok}`}>6 Safe</span>
            <span className={`${styles.chip} ${styles.warn}`}>2 Soon</span>
            <span className={`${styles.chip} ${styles.alert}`}>1 Past</span>
          </div>

          <div className={styles.list}>
            <div className={styles.item}>
              <div className={styles.itemTitle}>Metformin 500 mg</div>
              <div className={styles.itemMeta}>Kitchen shelf · 42 tablets</div>
              <div className={`${styles.itemStatus} ${styles.okText}`}>✓ IN DATE · 148 DAYS</div>
            </div>

            <div className={`${styles.item} ${styles.itemWarn}`}>
              <div className={styles.itemTitle}>Eye Drops (Opened)</div>
              <div className={styles.itemMeta}>Bedside · Opened 18d ago</div>
              <div className={`${styles.itemStatus} ${styles.warnText}`}>! USE SOON · 10 DAYS</div>
            </div>

            <div className={`${styles.item} ${styles.itemAlert}`}>
              <div className={styles.itemTitle}>Cough Syrup</div>
              <div className={styles.itemMeta}>Bathroom · Safe disposal</div>
              <div className={`${styles.itemStatus} ${styles.alertText}`}>
                × EXPIRED · 3 DAYS AGO
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === 'reminder' && (
        <div className={styles.body}>
          <div className={styles.heading}>Evening Dose</div>
          <div className={styles.sub}>Scheduled for 8:00 PM</div>

          <div className={styles.focusCard}>
            <div className={styles.focusBadge}>Due now</div>
            <div className={styles.focusTitle}>Vitamin D3 1000 IU</div>
            <div className={styles.focusNote}>1 tablet · Stock updates on log (28 left)</div>
            <div className={styles.actionRow}>
              <span className={styles.actionPrimary}>Taken</span>
              <span className={styles.actionGhost}>Snooze</span>
              <span className={styles.actionGhost}>Skip</span>
            </div>
          </div>

          <div className={styles.item}>
            <div className={styles.itemTitle}>Morning Dose · Logged</div>
            <div className={styles.itemMeta}>Taken at 8:12 AM · 29 → 28 tablets</div>
          </div>
        </div>
      )}

      {screen === 'refill' && (
        <div className={styles.body}>
          <div className={styles.heading}>Refill Alerts</div>
          <div className={styles.sub}>Based on quantity &amp; daily dose</div>

          <div className={`${styles.focusCard} ${styles.itemWarn}`}>
            <div className={styles.warnText}>! 5 DAYS REMAINING</div>
            <div className={styles.focusTitle}>Metformin 500 mg</div>
            <div className={styles.focusNote}>10 tablets left at 2 tablets per day</div>
          </div>

          <div className={styles.list}>
            <div className={styles.item}>
              <div className={styles.itemTitle}>Calcium Citrate</div>
              <div className={styles.itemMeta}>18 days left · 18 tablets</div>
              <div className={`${styles.itemStatus} ${styles.okText}`}>✓ ENOUGH STOCK</div>
            </div>
          </div>
        </div>
      )}

      {screen === 'family' && (
        <div className={styles.body}>
          <div className={styles.heading}>Family Care</div>
          <div className={styles.sub}>Shared adherence overview</div>

          <div className={styles.item}>
            <div className={styles.itemTitle}>Mom · Evening Schedule</div>
            <div className={styles.itemMeta}>Logged Taken at 8:04 PM</div>
            <div className={`${styles.itemStatus} ${styles.okText}`}>✓ ALL LOGGED TODAY</div>
          </div>

          <div className={`${styles.item} ${styles.itemAlert}`}>
            <div className={styles.itemTitle}>Missed Dose Alert Rule</div>
            <div className={styles.itemMeta}>Caregiver notified after 30 min</div>
            <div className={`${styles.itemStatus} ${styles.alertText}`}>● ACTIVE MONITOR</div>
          </div>
        </div>
      )}

      <div className={styles.dock}>
        <span className={styles.dockPrimary}>Log dose</span>
        <span className={styles.dockSecondary}>Scan strip</span>
      </div>
    </div>
  );
}
