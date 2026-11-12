import type { Metadata } from 'next';
import { LandingStage } from '@/components/sections/LandingStage';
import { OG_IMAGE } from '@/lib/site';

export const metadata: Metadata = {
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
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MedBuddy — Every dose. Every expiry. Every loved one.',
    description:
      'Track expiry dates, opened-bottle countdowns, dose reminders, refills, and shared family adherence.',
    images: [OG_IMAGE.url],
  },
};

export default function LandingPage() {
  return <LandingStage />;
}
