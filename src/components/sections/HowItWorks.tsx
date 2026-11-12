'use client';

import { useState } from 'react';
import { setActivePhoneScreen, type PhoneScreenId } from '@/lib/sceneState';
import styles from './HowItWorks.module.scss';

export interface HowItWorksStep {
  step: string;
  title: string;
  description: string;
  screen: PhoneScreenId;
  screenSummary: string;
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    step: '01',
    title: 'Add a medicine',
    description:
      'Enter it by hand or scan the strip or box. Store quantity, expiry date, batch number, and where it sits in your home.',
    screen: 'cabinet',
    screenSummary: 'Cabinet view sorts items into green In date, amber Use soon, and red Expired.',
  },
  {
    step: '02',
    title: 'Set the schedule',
    description:
      'Choose simple daily dose times for mornings, meals, or bedtime. Switch on large-text mode whenever needed.',
    screen: 'reminder',
    screenSummary:
      'Evening Dose card shows Vitamin D3 1000 IU with one-tap Taken, Snooze, and Skip.',
  },
  {
    step: '03',
    title: 'Get reminded',
    description:
      'Log Taken, Skipped, or Snoozed in one tap. Remaining quantity updates automatically to calculate refill and 30, 15, and 7 day expiry alerts.',
    screen: 'refill',
    screenSummary: 'Refill Alerts calculates days remaining from stock count and daily dose.',
  },
  {
    step: '04',
    title: 'Family stays informed',
    description:
      'Share adherence with a caregiver so they can see when a parent takes a dose, receive an alert if one is missed, or export a doctor-ready PDF report.',
    screen: 'family',
    screenSummary: 'Family Care displays shared daily logging and active missed-dose alerts.',
  },
];

export interface HowItWorksProps {
  activeStep?: number;
  onSelectStep?: (stepIndex: number) => void;
}

export function HowItWorks({ activeStep: controlledStep, onSelectStep }: HowItWorksProps) {
  const [localStep, setLocalStep] = useState(0);
  const currentStep = controlledStep ?? localStep;
  const activeItem = HOW_IT_WORKS_STEPS[currentStep] ?? HOW_IT_WORKS_STEPS[0]!;

  const handleSelect = (idx: number) => {
    setLocalStep(idx);
    const target = HOW_IT_WORKS_STEPS[idx];
    if (target) {
      setActivePhoneScreen(target.screen);
    }
    onSelectStep?.(idx);
  };

  return (
    <section id="how-it-works" className={styles.section} aria-labelledby="how-heading">
      <div className={styles.pinStage} data-how-pin>
        <div className={styles.container}>
          <div className={styles.leftCol}>
            <header className={styles.header}>
              <p className={styles.sectionCode}>02 / HOW IT WORKS</p>
              <h2 id="how-heading" className={styles.heading}>
                Four calm steps from box to <em>peace of mind.</em>
              </h2>
            </header>

            <ol className={styles.steps}>
              {HOW_IT_WORKS_STEPS.map((item, idx) => {
                const isActive = idx === currentStep;
                return (
                  <li key={item.step} className={styles.stepItem} data-active={isActive}>
                    <button
                      type="button"
                      className={styles.stepButton}
                      aria-current={isActive ? 'step' : undefined}
                      onClick={() => handleSelect(idx)}
                      data-cursor="interactive"
                    >
                      <span className={styles.stepNum}>{item.step}</span>
                      <span className={styles.stepBody}>
                        <span className={styles.stepTitle}>{item.title}</span>
                        <span className={styles.stepDesc}>{item.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className={styles.rightCol} aria-live="polite">
            <div className={styles.domScreenSummary}>
              <span className={styles.summaryMeta}>
                STEP {activeItem.step} · SCREEN PREVIEW · ILLUSTRATIVE
              </span>
              <p className={styles.summaryTitle}>{activeItem.title}</p>
              <p className={styles.summaryText}>{activeItem.screenSummary}</p>
              <div className={styles.progressTrack} aria-hidden="true">
                {HOW_IT_WORKS_STEPS.map((s, idx) => (
                  <span
                    key={s.step}
                    className={styles.progressSegment}
                    data-filled={idx <= currentStep}
                  />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
