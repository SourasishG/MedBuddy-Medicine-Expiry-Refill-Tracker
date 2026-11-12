import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { OG_IMAGE } from '@/lib/site';

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
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Offline — MedBuddy',
    description:
      'MedBuddy could not reach the network just now. Reconnect and try again, or open your early-access shell.',
    images: [OG_IMAGE.url],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function OfflineLayout({ children }: { children: ReactNode }) {
  return children;
}
