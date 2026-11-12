import styles from './Privacy.module.scss';

export function Privacy() {
  return (
    <section id="privacy" className={styles.section} aria-labelledby="privacy-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.monoLabel}>06 / PRIVACY &amp; SAFETY</span>
          <h2 id="privacy-heading" className={styles.title}>
            Built for family health records, with <em>plain boundaries.</em>
          </h2>
          <p className={styles.lead}>
            MedBuddy is designed to keep reminders simple and trust explicit. Here is what the
            product handles, what it stays out of, and the controls in your hands.
          </p>
        </header>

        <div className={styles.specGrid}>
          <div className={styles.specCol}>
            <div className={styles.colHead}>
              <span className={styles.colTitle}>WHAT MEDBUDDY DOES</span>
              <span className={styles.colIndex}>01</span>
            </div>
            <ul className={styles.list}>
              <li className={styles.item}>
                <h3 className={styles.itemTitle}>Cabinet &amp; opened-date tracking</h3>
                <p className={styles.itemCopy}>
                  Records medicine names, quantities, batch numbers, storage spots, opened dates,
                  and 30, 15, and 7 day expiry alerts.
                </p>
              </li>
              <li className={styles.item}>
                <h3 className={styles.itemTitle}>Reminders &amp; stock logging</h3>
                <p className={styles.itemCopy}>
                  Prompts scheduled doses with Taken, Skipped, or Snoozed actions that keep stock
                  and refill predictions in sync.
                </p>
              </li>
              <li className={styles.item}>
                <h3 className={styles.itemTitle}>Family view &amp; PDF exports</h3>
                <p className={styles.itemCopy}>
                  Shares adherence with invited caregivers, sends missed-dose alerts, offers
                  safe-disposal guidance, and creates doctor-ready PDF reports.
                </p>
              </li>
            </ul>
          </div>

          <div className={styles.specCol}>
            <div className={styles.colHead}>
              <span className={styles.colTitle}>WHAT IT NEVER DOES</span>
              <span className={`${styles.colIndex} ${styles.colNever}`}>02</span>
            </div>
            <ul className={styles.list}>
              <li className={styles.item}>
                <h3 className={styles.itemTitle}>Never recommends doses</h3>
                <p className={styles.itemCopy}>
                  MedBuddy tracks the schedule you enter. It never calculates, suggests, or alters
                  dosage instructions.
                </p>
              </li>
              <li className={styles.item}>
                <h3 className={styles.itemTitle}>Never gives medical advice</h3>
                <p className={styles.itemCopy}>
                  It provides no diagnosis, treatment guidance, or clinical decisions. Always follow
                  your doctor’s or pharmacist’s advice.
                </p>
              </li>
              <li className={styles.item}>
                <h3 className={styles.itemTitle}>Never guesses silently</h3>
                <p className={styles.itemCopy}>
                  Statuses pair clear icons and plain text labels so nothing relies on vague scores
                  or colour alone.
                </p>
              </li>
            </ul>
          </div>

          <div className={styles.specCol}>
            <div className={styles.colHead}>
              <span className={styles.colTitle}>YOUR CONTROLS</span>
              <span className={styles.colIndex}>03</span>
            </div>
            <ul className={styles.list}>
              <li className={styles.item}>
                <h3 className={styles.itemTitle}>Passwordless sign-in</h3>
                <p className={styles.itemCopy}>
                  Sign in with your phone number or Google account—no complicated passwords to lose
                  or reset.
                </p>
              </li>
              <li className={styles.item}>
                <h3 className={styles.itemTitle}>Logged-in devices</h3>
                <p className={styles.itemCopy}>
                  See which phones or tablets are signed in to your account and remove devices you
                  no longer use.
                </p>
              </li>
              <li className={styles.item}>
                <h3 className={styles.itemTitle}>Delete my data</h3>
                <p className={styles.itemCopy}>
                  Remove your cabinet, logs, and account data directly from your settings whenever
                  you choose.
                </p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
