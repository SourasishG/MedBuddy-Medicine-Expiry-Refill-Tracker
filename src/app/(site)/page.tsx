import type { Metadata } from 'next';
import { LandingStage } from '@/components/sections/LandingStage';

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
  },
};

export default function LandingPage() {
  return <LandingStage />;
}
