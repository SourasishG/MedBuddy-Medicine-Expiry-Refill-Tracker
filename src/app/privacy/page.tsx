import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './privacy.module.scss';

export const metadata: Metadata = {
  title: 'Privacy Notice — MedBuddy',
  description:
    'How the MedBuddy website handles information. No accounts, no advertising trackers, and no cookies.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.brandLink}>
            MEDBUDDY
          </Link>
          <Link href="/" className={styles.backLink}>
            Back to MedBuddy
          </Link>
        </div>

        <header className={styles.header}>
          <span className={styles.mono}>LAST UPDATED: 12 NOVEMBER 2026</span>
          <h1 className={styles.title}>Privacy notice</h1>
          <p className={styles.intro}>
            MedBuddy is a medicine expiry and refill tracker. This notice explains how this website
            (the “site”) handles information. It covers the website only. The MedBuddy app will have
            its own privacy notice, which you will see before the app collects any personal or
            health information.
          </p>
        </header>

        <div className={styles.sections}>
          <section className={styles.block} aria-labelledby="short-version">
            <h2 id="short-version" className={styles.heading}>
              The short version
            </h2>
            <ul className={styles.list}>
              <li>
                The site has no accounts, sign-up forms or comments. You can browse it without
                giving us any personal details.
              </li>
              <li>
                We do not sell information, and we do not use analytics or advertising scripts.
              </li>
              <li>
                A few small settings are saved on your own device so the site works the way you left
                it.
              </li>
            </ul>
          </section>

          <section className={styles.block} aria-labelledby="who-we-are">
            <h2 id="who-we-are" className={styles.heading}>
              Who we are
            </h2>
            <p className={styles.body}>
              The site is run by Sourasish Ghosh, based in Kolkata, India. You can reach us at{' '}
              <a href="mailto:ghoshsourasish1@gmail.com">ghoshsourasish1@gmail.com</a>.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="what-we-collect">
            <h2 id="what-we-collect" className={styles.heading}>
              What we collect and why
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Information</th>
                    <th scope="col">When</th>
                    <th scope="col">Why</th>
                    <th scope="col">Where it stays</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      Technical request data: IP address, browser and device type, pages requested,
                      date and time
                    </td>
                    <td>Every visit</td>
                    <td>To deliver the site, keep it secure and fix problems</td>
                    <td>
                      Server logs at our hosting provider, Vercel, for up to 1 hour on Vercel’s
                      Hobby plan (or up to 1 day on Pro)
                    </td>
                  </tr>
                  <tr>
                    <td>
                      Settings saved on your device: your Motion on/off choice, and whether you have
                      already seen the intro animation
                    </td>
                    <td>When you use the Motion toggle or load the intro</td>
                    <td>To remember your choice</td>
                    <td>Your browser’s local and session storage only. It is never sent to us</td>
                  </tr>
                  <tr>
                    <td>Site files saved by the service worker</td>
                    <td>If you install MedBuddy to your home screen</td>
                    <td>So the site opens quickly and works offline</td>
                    <td>Your device only</td>
                  </tr>
                  <tr>
                    <td>Emails you send us</td>
                    <td>If you write to us</td>
                    <td>To reply to you</td>
                    <td>Our email provider, Google (Gmail), for as long as needed to answer you</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={styles.body}>
              We do not ask for or collect names, phone numbers or health information through the
              site.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="cookies-storage">
            <h2 id="cookies-storage" className={styles.heading}>
              Cookies and browser storage
            </h2>
            <p className={styles.body}>
              The site does not set cookies. It uses the browser storage described above, which
              exists only to provide features you chose. You can clear it at any time in your
              browser’s settings, and the site will keep working.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="installing-pwa">
            <h2 id="installing-pwa" className={styles.heading}>
              Installing MedBuddy to your home screen
            </h2>
            <p className={styles.body}>
              When you tap Install, your browser and device add MedBuddy to your home screen. We do
              not receive any information about whether or how you installed it.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="other-companies">
            <h2 id="other-companies" className={styles.heading}>
              Other companies that handle information
            </h2>
            <ul className={styles.list}>
              <li>
                <strong>Hosting.</strong> Vercel serves the site and processes the request data
                described above on our behalf. It may process that data in countries other than
                yours.
              </li>
              <li>
                <strong>Fonts, graphics and QR codes.</strong> These are served from our own site,
                not from third-party services.
              </li>
              <li>We do not share information with advertisers or data brokers.</li>
            </ul>
          </section>

          <section className={styles.block} aria-labelledby="choices-rights">
            <h2 id="choices-rights" className={styles.heading}>
              Your choices and rights
            </h2>
            <p className={styles.body}>
              You can use the site without giving us personal information. Depending on where you
              live, including under India’s Digital Personal Data Protection Act, 2023 and similar
              laws, you may have the right to ask what personal information we hold about you, to
              have it corrected or deleted, and to complain to the relevant authority. Email{' '}
              <a href="mailto:ghoshsourasish1@gmail.com">ghoshsourasish1@gmail.com</a> and we will
              respond within 2 hours.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="security-section">
            <h2 id="security-section" className={styles.heading}>
              Security
            </h2>
            <p className={styles.body}>
              The site is served over HTTPS, and we keep the information we hold to the minimum
              described above. No website can promise perfect security.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="children-section">
            <h2 id="children-section" className={styles.heading}>
              Children
            </h2>
            <p className={styles.body}>
              The site is not directed at children, and we do not knowingly collect personal
              information from them.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="changes-section">
            <h2 id="changes-section" className={styles.heading}>
              Changes to this notice
            </h2>
            <p className={styles.body}>
              If we change how the site handles information, we will update this page and the date
              at the top.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="contact-section">
            <h2 id="contact-section" className={styles.heading}>
              Contact
            </h2>
            <p className={styles.body}>
              Questions about this notice:{' '}
              <a href="mailto:ghoshsourasish1@gmail.com">ghoshsourasish1@gmail.com</a>
            </p>
          </section>
        </div>

        <p className={styles.footerNote}>
          MedBuddy is a reminder and tracking tool. It does not provide medical advice, diagnosis or
          treatment. Always follow your doctor’s instructions.
        </p>
      </div>
    </main>
  );
}
