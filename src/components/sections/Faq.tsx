'use client';

import { useState } from 'react';
import { m } from 'framer-motion';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import styles from './Faq.module.scss';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'password',
    question: 'Do I need a password?',
    answer:
      'No. MedBuddy uses passwordless sign-in with your phone number or your Google account, so older relatives and caregivers do not have to manage another password.',
  },
  {
    id: 'platforms',
    question: 'Does it work on iPhone and Android?',
    answer:
      'Yes. MedBuddy installs directly as a web app on Android and iPhone or iPad. On desktop, the Install panel also displays a QR code so you can open and install it straight on your phone.',
  },
  {
    id: 'family',
    question: 'Can my family see my medicines?',
    answer:
      'Only if you turn on family sharing for a caregiver. Once connected, caregivers can view adherence progress and receive missed-dose alerts. Exact per-medicine sharing toggles are being finalised prior to app launch.',
  },
  {
    id: 'advice',
    question: 'Does MedBuddy give medical advice?',
    answer:
      'Never. MedBuddy is strictly a reminder and tracking tool for expiry dates, opened dates, schedules, and refills. It does not recommend doses, diagnose, or replace your doctor or pharmacist.',
  },
  {
    id: 'delete',
    question: 'Can I delete my data?',
    answer:
      'Yes. Inside Your Controls, you can review logged-in devices and delete your data. Final deletion-window timing details will be published in our privacy notice before the full app opens.',
  },
  {
    id: 'website-install',
    question: 'Why install from the website instead of an app store?',
    answer:
      'Installing from the website avoids app store delays and works identically from one link across Android and iPhone. Early installers also receive updates automatically once the full MedBuddy app launches.',
  },
  {
    id: 'early-access',
    question: 'What happens when I install it right now?',
    answer:
      'Today you are installing the lightweight MedBuddy early-access shell onto your home screen. Until launch, opening the icon shows a calm “launching soon” screen, and it updates automatically when the app goes live.',
  },
];

export function Faq() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);
  const { motionEnabled } = useMotionPreference();

  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.monoLabel}>07 / FAQ</span>
          <h2 id="faq-heading" className={styles.title}>
            Plain answers before you <em>install.</em>
          </h2>
          <p className={styles.lead}>
            Straightforward answers about sign-in, phones, family sharing, and what early-access
            installation includes right now.
          </p>
        </header>

        <div className={styles.accordion}>
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            const panelId = `faq-panel-${item.id}`;
            const buttonId = `faq-btn-${item.id}`;

            return (
              <div key={item.id} className={styles.row}>
                <button
                  id={buttonId}
                  type="button"
                  className={styles.trigger}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                >
                  <span className={styles.question}>{item.question}</span>
                  <span className={styles.plusIcon} data-open={isOpen} aria-hidden="true">
                    +
                  </span>
                </button>

                <m.div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!isOpen}
                  inert={!isOpen}
                  className={styles.answerWrap}
                  initial={false}
                  animate={isOpen ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
                  transition={{
                    duration: motionEnabled ? 0.35 : 0.001,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className={styles.answerInner}>{item.answer}</div>
                </m.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
