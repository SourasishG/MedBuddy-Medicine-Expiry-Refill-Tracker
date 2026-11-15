import type { Metadata } from 'next';
import styles from './privacy.module.scss';

export const metadata: Metadata = {
  title: 'App Privacy Notice · MedBuddy',
  description: 'How MedBuddy handles and protects your medication information.',
};

export default function AppPrivacyPage() {
  return (
    <div className={styles.container}>
      <span className={styles.badge}>Draft: needs legal review before launch</span>
      <h1 className={styles.title}>MedBuddy App Privacy Notice</h1>

      <section className={styles.section}>
        <h2>1. Data We Store</h2>
        <p>When you use the MedBuddy application, we store the following data in Supabase:</p>
        <ul>
          <li>
            <strong>Account & Session:</strong> Your email address and authenticated user identifier.
          </li>
          <li>
            <strong>Care Profiles:</strong> Profile name, timezone, and adherence configuration
            (snooze duration, missed thresholds, re-nudge intervals, and lock-screen privacy
            preferences).
          </li>
          <li>
            <strong>Medicines:</strong> Name, strength, dosage form, category, notes, and whether
            the medication is taken as needed (PRN).
          </li>
          <li>
            <strong>Inventory Boxes:</strong> Quantity remaining, unit, batch number, expiry date,
            storage location, and discard status (managed via first-expiry-first-out logic).
          </li>
          <li>
            <strong>Schedules:</strong> Scheduled times of day, active days of the week, target
            dose, and special instructions.
          </li>
          <li>
            <strong>Intake & Adherence Logs:</strong> Scheduled time, recorded timestamp, status
            (taken, skipped, snoozed, missed), dose quantity, notes, and whether it was taken as
            needed.
          </li>
          <li>
            <strong>Audit & Security Logs:</strong> Minimal operational timestamps and action types
            for security verification and data integrity.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>2. Cookies Set by Sign-In</h2>
        <p>
          The marketing website at <code>/</code>, <code>/privacy</code>, and <code>/offline</code> sets
          zero cookies. The authenticated MedBuddy application at <code>/app</code> uses strictly
          essential sign-in cookies:
        </p>
        <ul>
          <li>
            <strong>Supabase Auth Tokens (<code>sb-*-auth-token</code>):</strong> Essential HttpOnly
            session tokens that securely authenticate requests between your browser and the
            Supabase backend.
          </li>
          <li>
            <strong>App State Cookie (<code>medbuddy_app_state</code>):</strong> A short-lived
            (10-minute), HMAC-SHA256 signed, HttpOnly, SameSite=Lax cookie scoped strictly to{' '}
            <code>/app</code>. It caches only your verified user ID and two binary onboarding flags
            (consent given and profile created) to eliminate redundant database queries on page
            navigation. It never contains medication names, medical notes, or personal health
            details, and is cleared upon sign-out or account deletion.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>3. Push Subscriptions</h2>
        <p>
          Push notifications are completely optional. Only when you explicitly click “Enable
          reminders” in Settings or on the Today screen do we register a browser push subscription.
        </p>
        <ul>
          <li>
            We store the standard Web Push (VAPID) endpoint URL and public cryptographic keys (
            <code>p256dh</code> and <code>auth</code>) linked to your active profile in the{' '}
            <code>push_subscriptions</code> table.
          </li>
          <li>
            We never share your push subscription with any third party, advertiser, or analytics
            provider.
          </li>
          <li>
            You can revoke push permissions at any time via your browser settings or remove the
            subscription directly in Settings.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>4. Local Storage Keys</h2>
        <p>MedBuddy saves minimal user interface preferences directly on your device:</p>
        <ul>
          <li>
            <code>medbuddy-active-care-profile</code>: The UUID of your currently selected care
            profile, allowing the app to restore your active view immediately upon reopening.
          </li>
          <li>
            <code>medbuddy-theme</code>: Your dark or light theme preference (defaults to system
            appearance).
          </li>
          <li>
            <code>medbuddy-motion</code>: Your animation preference (<code>full</code> or{' '}
            <code>reduced</code>).
          </li>
          <li>
            <code>medbuddy-large-text</code>: Your accessibility high-legibility text preference (
            <code>true</code> or <code>false</code>).
          </li>
          <li>
            <code>medbuddy_pwa_dismissed</code>: Timestamp recording if you dismissed the home screen
            install prompt.
          </li>
        </ul>
        <p>No medication records or health logs are ever saved in local storage or unencrypted browser caches.</p>
      </section>

      <section className={styles.section}>
        <h2>5. Medical Disclaimer</h2>
        <p>
          MedBuddy is a medication adherence, expiry, and refill tracking tool. It is not a medical
          device and does not provide medical advice, diagnosis, or clinical recommendations. Always
          consult your physician or pharmacist for clinical guidance.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Your Data Rights</h2>
        <p>
          Under our data protection principles, you retain full ownership of your data:
        </p>
        <ul>
          <li>
            <strong>Download My Data:</strong> You can export a comprehensive, machine-readable JSON
            archive of all your profiles, medicines, inventory, schedules, and intake logs at any
            time from Settings.
          </li>
          <li>
            <strong>Delete My Account & Data:</strong> You can permanently delete your account and
            all associated records at any time. We execute a clean cascade across all database
            tables, leaving zero residual records behind.
          </li>
        </ul>
      </section>
    </div>
  );
}
