import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Offline — MedBuddy',
  description:
    'MedBuddy could not reach the network just now. Reconnect and try again, or open your early-access shell.',
  alternates: {
    canonical: '/offline',
  },
  openGraph: {
    title: 'Offline — MedBuddy',
    description:
      'MedBuddy could not reach the network just now. Reconnect and try again, or open your early-access shell.',
    url: '/offline',
    siteName: 'MedBuddy',
    type: 'website',
    locale: 'en_US',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function OfflineLayout({ children }: { children: ReactNode }) {
  return children;
}
