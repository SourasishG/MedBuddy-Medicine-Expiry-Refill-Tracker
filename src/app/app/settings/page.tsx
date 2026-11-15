'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  useCareProfile,
  type CareProfileWithRole,
} from '@/features/care-profile/CareProfileContext';
import {
  validateProfileSettings,
  getUpdateErrorMessage,
  DEFAULT_FALLBACK_SNOOZE_MINUTES,
  PERMISSION_DENIED_MESSAGE,
} from '@/features/care-profile/profile-settings-validation';
import styles from './settings.module.scss';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const {
    isLargeText,
    setLargeText,
    careProfiles,
    activeCareProfile,
    setActiveProfileId,
    refetchProfiles,
  } = useCareProfile();
  const [, startTransition] = useTransition();

  // Profile editing state
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTimezone, setEditTimezone] = useState('Asia/Kolkata');
  const [editSnoozeMinutes, setEditSnoozeMinutes] = useState<number | ''>(
    DEFAULT_FALLBACK_SNOOZE_MINUTES,
  );
  const [editMissedMinutes, setEditMissedMinutes] = useState<number | ''>(120);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const startEditing = (profile: CareProfileWithRole) => {
    // Edit form is strictly permitted for profile owners only
    if (profile.role !== 'owner') return;
    setEditingProfileId(profile.id);
    setEditName(profile.name);
    setEditTimezone(profile.timezone || 'Asia/Kolkata');
    setEditSnoozeMinutes(profile.snooze_minutes ?? DEFAULT_FALLBACK_SNOOZE_MINUTES);
    setEditMissedMinutes(profile.missed_after_minutes ?? 120);
    setSaveFeedback(null);
  };

  const cancelEditing = () => {
    setEditingProfileId(null);
    setSaveFeedback(null);
  };

  const handleSaveProfile = async (profileId: string) => {
    const targetProfile = careProfiles.find((p) => p.id === profileId);
    if (!targetProfile || targetProfile.role !== 'owner') {
      setSaveFeedback({
        type: 'error',
        message: PERMISSION_DENIED_MESSAGE,
      });
      return;
    }

    const validation = validateProfileSettings({
      name: editName,
      snoozeMinutes: editSnoozeMinutes,
      missedMinutes: editMissedMinutes,
      renudgeMinutes: targetProfile.renudge_after_minutes,
    });

    if (
      !validation.isValid ||
      !validation.cleanName ||
      validation.snoozeMinutes === undefined ||
      validation.missedMinutes === undefined
    ) {
      setSaveFeedback({
        type: 'error',
        message: validation.error || 'Please check your inputs and try again.',
      });
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const { data, error } = await supabase
        .from('care_profiles')
        .update({
          name: validation.cleanName,
          timezone: editTimezone,
          snooze_minutes: validation.snoozeMinutes,
          missed_after_minutes: validation.missedMinutes,
        })
        .eq('id', profileId)
        .select('id');

      const updateError = getUpdateErrorMessage(error, data?.length ?? 0);
      if (updateError) {
        setSaveFeedback({
          type: 'error',
          message: updateError,
        });
        setIsSaving(false);
        return;
      }

      await refetchProfiles();
      setSaveFeedback({ type: 'success', message: 'Care profile updated successfully!' });
      setIsSaving(false);
      setTimeout(() => {
        setEditingProfileId(null);
        setSaveFeedback(null);
      }, 800);
    } catch {
      setSaveFeedback({
        type: 'error',
        message: 'A network error occurred while updating profile.',
      });
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    document.cookie = 'medbuddy_app_state=; path=/app; max-age=0';
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace('/app/sign-in');
    });
  };

  return (
    <div className={styles.settingsContainer}>
      <h1 className={styles.heading}>Settings</h1>

      {/* Appearance & Comfort */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Appearance & Comfort</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Large text</div>
              <div className={styles.rowDesc}>
                Scales medicine text, buttons and doses for easier reading.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isLargeText}
              className={styles.toggle}
              data-checked={isLargeText}
              onClick={() => setLargeText(!isLargeText)}
            >
              <div className={styles.toggleKnob} />
            </button>
          </div>
        </div>
      </section>

      {/* Care Profiles Management (Phase A2) */}
      <section id="profiles" className={styles.section}>
        <div className={styles.sectionTitle}>Care Profiles</div>
        <div className={styles.card}>
          {careProfiles.map((profile) => {
            const isActive = profile.id === activeCareProfile?.id;
            const isEditing = editingProfileId === profile.id;
            const isOwner = profile.role === 'owner';
            const initial = (profile.name || 'P').charAt(0).toUpperCase();

            return (
              <div key={profile.id} className={styles.profileItem} data-active={isActive}>
                <div className={styles.profileItemHeader}>
                  <div className={styles.profileMeta}>
                    <span className={styles.avatarInitial} aria-hidden="true">
                      {initial}
                    </span>
                    <div>
                      <div className={styles.profileName}>{profile.name}</div>
                      <div className={styles.profileSubtext}>
                        {profile.role || 'owner'} · {profile.timezone}
                      </div>
                    </div>
                  </div>

                  <div className={styles.profileActions}>
                    {isActive ? (
                      <span className={styles.activeBadge}>Active</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => setActiveProfileId(profile.id)}
                      >
                        Set active
                      </button>
                    )}

                    {isOwner && !isEditing && (
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => startEditing(profile)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Profile Editor (shown only to owners) */}
                {isOwner && isEditing && (
                  <form
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSaveProfile(profile.id);
                    }}
                    className={styles.editForm}
                  >
                    <div className={styles.inputGroup}>
                      <label htmlFor={`edit-name-${profile.id}`} className={styles.label}>
                        Display Name
                      </label>
                      <input
                        id={`edit-name-${profile.id}`}
                        type="text"
                        className={styles.input}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        disabled={isSaving}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label htmlFor={`edit-tz-${profile.id}`} className={styles.label}>
                        Timezone
                      </label>
                      <select
                        id={`edit-tz-${profile.id}`}
                        className={styles.select}
                        value={editTimezone}
                        onChange={(e) => setEditTimezone(e.target.value)}
                        disabled={isSaving}
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                        <option value="America/Denver">America/Denver (MST/MDT)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
                        <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>

                    <div className={styles.formGrid}>
                      <div className={styles.inputGroup}>
                        <label htmlFor={`edit-snooze-${profile.id}`} className={styles.label}>
                          Snooze duration (5–120 mins)
                        </label>
                        <input
                          id={`edit-snooze-${profile.id}`}
                          type="number"
                          min={5}
                          max={120}
                          step={1}
                          className={styles.input}
                          value={editSnoozeMinutes}
                          onChange={(e) =>
                            setEditSnoozeMinutes(
                              e.target.value === '' ? '' : Number(e.target.value),
                            )
                          }
                          disabled={isSaving}
                          required
                        />
                      </div>

                      <div className={styles.inputGroup}>
                        <label htmlFor={`edit-missed-${profile.id}`} className={styles.label}>
                          Mark missed after (30–720 mins)
                        </label>
                        <input
                          id={`edit-missed-${profile.id}`}
                          type="number"
                          min={30}
                          max={720}
                          step={5}
                          className={styles.input}
                          value={editMissedMinutes}
                          onChange={(e) =>
                            setEditMissedMinutes(
                              e.target.value === '' ? '' : Number(e.target.value),
                            )
                          }
                          disabled={isSaving}
                          required
                        />
                      </div>
                    </div>

                    {saveFeedback && (
                      <div className={styles.feedbackBox} data-variant={saveFeedback.type}>
                        {saveFeedback.message}
                      </div>
                    )}

                    <div className={styles.formButtonRow}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={cancelEditing}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                      <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}

          <Link href="/app/setup?mode=new" className={styles.addProfileBtn}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add another care profile</span>
          </Link>
        </div>
      </section>

      {/* Account */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Account</div>
        <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
          Sign out of MedBuddy
        </button>
      </section>
    </div>
  );
}
