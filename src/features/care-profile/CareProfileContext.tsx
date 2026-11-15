'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type CareProfile = Database['public']['Tables']['care_profiles']['Row'];
type UserProfile = Database['public']['Tables']['profiles']['Row'];
type CareRole = Database['public']['Enums']['care_role'];

export interface CareProfileWithRole extends CareProfile {
  role?: CareRole;
}

interface CareProfileContextValue {
  userProfile: UserProfile | null;
  careProfiles: CareProfileWithRole[];
  activeCareProfile: CareProfileWithRole | null;
  activeRole: CareRole;
  isLoading: boolean;
  isLargeText: boolean;
  setLargeText: (enabled: boolean) => Promise<void>;
  setActiveProfileId: (id: string) => void;
  isSwitcherOpen: boolean;
  setSwitcherOpen: (open: boolean) => void;
  refetchProfiles: () => Promise<void>;
}

const CareProfileContext = createContext<CareProfileContextValue | null>(null);

const STORAGE_ACTIVE_PROFILE = 'medbuddy-active-care-profile';

export function CareProfileProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(STORAGE_ACTIVE_PROFILE);
    } catch {
      return null;
    }
  });

  const [isSwitcherOpen, setSwitcherOpen] = useState(false);

  // 1. Fetch User Profile
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error.message);
        return null;
      }
      return data;
    },
  });

  // 2. Fetch Care Profiles & User's Roles
  const {
    data: careProfilesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['care-profiles'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      // Query care_access with care_profiles relation
      const { data: accessData, error: accessErr } = await supabase
        .from('care_access')
        .select(
          `
          role,
          care_profile_id,
          care_profiles (
            id,
            name,
            timezone,
            snooze_minutes,
            renudge_after_minutes,
            missed_after_minutes,
            linked_user_id,
            created_by,
            created_at
          )
        `,
        )
        .eq('user_id', user.id);

      if (accessErr) {
        console.error('Error fetching care profiles:', accessErr.message);
        return [];
      }

      const list: CareProfileWithRole[] = [];
      for (const row of accessData || []) {
        if (row.care_profiles) {
          list.push({
            ...(row.care_profiles as CareProfile),
            role: row.role,
          });
        }
      }
      return list;
    },
  });

  const careProfiles = useMemo(() => careProfilesData || [], [careProfilesData]);

  // Set active care profile (defaults to first profile if none stored or invalid)
  const activeCareProfile = useMemo(() => {
    if (careProfiles.length === 0) return null;
    if (activeProfileId) {
      const found = careProfiles.find((p) => p.id === activeProfileId);
      if (found) return found;
    }
    return careProfiles[0] || null;
  }, [careProfiles, activeProfileId]);

  const activeRole: CareRole = activeCareProfile?.role || 'owner';

  const setActiveProfileId = useCallback((id: string) => {
    setActiveProfileIdState(id);
    try {
      localStorage.setItem(STORAGE_ACTIVE_PROFILE, id);
    } catch {
      // ignore
    }
  }, []);

  // Large text setting
  const isLargeText = Boolean(userProfile?.large_text);

  const setLargeText = useCallback(
    async (enabled: boolean) => {
      if (!userProfile) return;
      const { error } = await supabase
        .from('profiles')
        .update({ large_text: enabled })
        .eq('id', userProfile.id);

      if (!error) {
        await queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      }
    },
    [supabase, userProfile, queryClient],
  );

  // Sync data-large-text on document element for CSS scaling
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.largeText = isLargeText ? 'true' : 'false';
    }
  }, [isLargeText]);

  const refetchProfiles = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value = useMemo(
    () => ({
      userProfile: userProfile || null,
      careProfiles,
      activeCareProfile,
      activeRole,
      isLoading,
      isLargeText,
      setLargeText,
      setActiveProfileId,
      isSwitcherOpen,
      setSwitcherOpen,
      refetchProfiles,
    }),
    [
      userProfile,
      careProfiles,
      activeCareProfile,
      activeRole,
      isLoading,
      isLargeText,
      setLargeText,
      setActiveProfileId,
      isSwitcherOpen,
      setSwitcherOpen,
      refetchProfiles,
    ],
  );

  return <CareProfileContext.Provider value={value}>{children}</CareProfileContext.Provider>;
}

export function useCareProfile(): CareProfileContextValue {
  const context = useContext(CareProfileContext);
  if (!context) {
    throw new Error('useCareProfile must be used within a CareProfileProvider');
  }
  return context;
}
