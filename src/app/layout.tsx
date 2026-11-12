import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, JetBrains_Mono, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import { MotionProvider } from '@/hooks/useMotionPreference';
import { SmoothScrollProvider } from '@/components/ui/SmoothScrollProvider';
import '@/styles/base.scss';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://medbuddy.app'),
  title: 'MedBuddy — Every dose. Every expiry. Every loved one.',
  description:
    'A calm medicine expiry, dose reminder, and refill tracker for patients and the families who care for them.',
  applicationName: 'MedBuddy',
  keywords: [
    'MedBuddy',
    'medicine expiry tracker',
    'dose reminder app',
    'refill tracker',
    'caregiver adherence alerts',
    'family medication tracker',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'MedBuddy — Every dose. Every expiry. Every loved one.',
    description:
      'Track expiry dates, opened-bottle countdowns, dose reminders, refills, and shared family adherence in one calm cabinet view.',
    url: '/',
    siteName: 'MedBuddy',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MedBuddy — Every dose. Every expiry. Every loved one.',
    description:
      'Track expiry dates, opened-bottle countdowns, dose reminders, refills, and shared family adherence.',
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'MedBuddy',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#090c12',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-motion="auto"
      className={`${instrumentSerif.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <MotionProvider>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
