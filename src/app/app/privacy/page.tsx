import type { Metadata } from 'next';
import styles from './privacy.module.scss';

export const metadata: Metadata = {
  title: 'App Privacy Notice · MedBuddy',
  description: 'How MedBuddy handles and protects your medication information.',
};

export default function AppPrivacyPage() {
  return (
    <div className={styles.container}>
      <span className={styles.badge}>Draft: Needs legal review before launch</span>
      <h1 className={styles.title}>MedBuddy App Privacy Notice</h1>

      <section className={styles.section}>
        <h2>1. Data We Store</h2>
        <p>When you use the MedBuddy application, we store:</p>
        <ul>
          <li>Your account email and authentication session state.</li>
          <li>Care profiles you create (name, timezone, adherence settings).</li>
          <li>Medicines, strengths, forms, batch numbers, storage notes, and expiry dates.</li>
          <li>Dose schedules and recorded dose events (taken, skipped, snoozed, missed).</li>
          <li>Device push subscriptions when you explicitly enable reminders.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>2. Cookies & Local Storage</h2>
        <p>
          Unlike the public marketing website (which sets zero cookies), the MedBuddy app at{' '}
          <code>/app</code> uses essential authentication cookies managed via Supabase SSR to
          maintain your signed-in session securely across requests.
        </p>
        <p>
          To ensure fast, calm page navigation, we also set an essential, short-lived (10-minute),
          HMAC-signed, HttpOnly cookie named <code>medbuddy_app_state</code> scoped strictly to{' '}
          <code>/app</code>. It securely caches your verified user identifier and status flags
          (whether health data consent and first-time setup are complete) to avoid repetitive
          database queries on every screen transition. It contains zero medication names, health
          details, or personal information, and is cleared immediately upon sign-out, consent
          withdrawal, or profile deletion. Real data authorization is always enforced by Supabase
          Row-Level Security (RLS) on the database.
        </p>
        <p>
          We also store your active care profile ID in <code>localStorage</code> under{' '}
          <code>medbuddy-active-care-profile</code> to restore your view when you reopen the app.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Medical Disclaimer</h2>
        <p>
          MedBuddy is a medication adherence, expiry, and refill tracking tool. It is not a medical
          device and does not provide medical advice, diagnosis, or clinical recommendations. Always
          consult your physician or pharmacist for clinical guidance.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Your Data Rights</h2>
        <p>
          You have the right to download all your data in JSON format or permanently erase your
          account and all associated health records at any time from the Settings screen.
        </p>
      </section>
    </div>
  );
}
