import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/providers/QueryProvider';
import { CareProfileProvider } from '@/features/care-profile/CareProfileContext';
import { AppShellClient } from '@/components/app/AppShellClient';

export const metadata: Metadata = {
  title: {
    default: 'MedBuddy',
    template: '%s · MedBuddy',
  },
  description: 'Track medicine expiry dates, doses, and refills calmly.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MedBuddyAppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <CareProfileProvider>
        <AppShellClient>{children}</AppShellClient>
      </CareProfileProvider>
    </QueryProvider>
  );
}
