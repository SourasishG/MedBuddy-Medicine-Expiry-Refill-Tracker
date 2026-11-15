'use client';

import { useState, useEffect, useTransition } from 'react';
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
import {
  getNotificationPermissionStatus,
  getCurrentPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendLocalTestNotification,
  type NotificationPermissionStatus,
} from '@/features/notifications/push-utils';
import { InstallCard } from '@/features/install/InstallCard';
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

  // Notifications & Reminders state
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [hideNames, setHideNames] = useState(false);
  const [notifyDue, setNotifyDue] = useState(true);
  const [notifyMissed, setNotifyMissed] = useState(true);
  const [notifyExpiry, setNotifyExpiry] = useState(true);
  const [notifFeedback, setNotifFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isBusyNotif, setIsBusyNotif] = useState(false);

  // Load notification settings and preferences
  useEffect(() => {
    async function loadNotificationSettings() {
      // 1. Check device permission and existing PushManager subscription
      if (typeof window !== 'undefined') {
        const perm = getNotificationPermissionStatus();
        setPermissionStatus(perm);
        if (perm === 'granted') {
          const sub = await getCurrentPushSubscription();
          setIsSubscribed(Boolean(sub));
        } else {
          setIsSubscribed(false);
        }
      }

      // 2. Fetch user profile preferences (hide_names_in_notifications)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('hide_names_in_notifications')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setHideNames(Boolean(profile.hide_names_in_notifications));
      }

      // 3. Fetch care_access alert preferences for active profile
      if (activeCareProfile) {
        const { data: access } = await supabase
          .from('care_access')
          .select('notify_due, notify_missed, notify_expiry')
          .eq('care_profile_id', activeCareProfile.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (access) {
          setNotifyDue(access.notify_due ?? true);
          setNotifyMissed(access.notify_missed ?? true);
          setNotifyExpiry(access.notify_expiry ?? true);
        }
      }
    }

    void loadNotificationSettings();
  }, [supabase, activeCareProfile]);

  const handleToggleDeviceReminders = async () => {
    setIsBusyNotif(true);
    setNotifFeedback(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (isSubscribed) {
        const res = await unsubscribeFromPush(supabase, user.id);
        if (res.ok) {
          setIsSubscribed(false);
          setNotifFeedback({
            type: 'success',
            message: 'Reminders turned off for this device.',
          });
        } else {
          setNotifFeedback({
            type: 'error',
            message: res.error || 'Could not unsubscribe from reminders.',
          });
        }
      } else {
        const res = await subscribeToPush(supabase, user.id);
        setPermissionStatus(res.status);
        if (res.ok) {
          setIsSubscribed(true);
          setNotifFeedback({
            type: 'success',
            message: 'Reminders turned on for this device.',
          });
        } else {
          setNotifFeedback({
            type: 'error',
            message: res.error || 'Could not enable reminders.',
          });
        }
      }
    } catch {
      setNotifFeedback({
        type: 'error',
        message: 'An unexpected error occurred while toggling reminders.',
      });
    } finally {
      setIsBusyNotif(false);
    }
  };

  const handleToggleHideNames = async () => {
    const nextVal = !hideNames;
    setHideNames(nextVal);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ hide_names_in_notifications: nextVal })
        .eq('id', user.id);

      if (error) {
        setHideNames(!nextVal);
        setNotifFeedback({
          type: 'error',
          message: 'Could not update privacy setting. Please try again.',
        });
      }
    } catch {
      setHideNames(!nextVal);
    }
  };

  const handleUpdateAlertPref = async (key: 'due' | 'missed' | 'expiry', val: boolean) => {
    if (!activeCareProfile) return;
    const nextDue = key === 'due' ? val : notifyDue;
    const nextMissed = key === 'missed' ? val : notifyMissed;
    const nextExpiry = key === 'expiry' ? val : notifyExpiry;

    if (key === 'due') setNotifyDue(val);
    if (key === 'missed') setNotifyMissed(val);
    if (key === 'expiry') setNotifyExpiry(val);

    try {
      const { error } = await supabase.rpc('fn_set_my_notifications', {
        p_care_profile: activeCareProfile.id,
        p_due: nextDue,
        p_missed: nextMissed,
        p_expiry: nextExpiry,
      });

      if (error) {
        setNotifFeedback({
          type: 'error',
          message: 'Could not update alert preferences.',
        });
      }
    } catch {
      setNotifFeedback({
        type: 'error',
        message: 'Could not update alert preferences.',
      });
    }
  };

  const handleSendTestReminder = async () => {
    setIsBusyNotif(true);
    setNotifFeedback(null);
    try {
      const sent = await sendLocalTestNotification();
      if (sent) {
        setNotifFeedback({
          type: 'success',
          message: 'Test reminder sent! Check your notification tray or lock screen.',
        });
      } else {
        setNotifFeedback({
          type: 'error',
          message:
            'Could not send test reminder. Please ensure notifications are enabled on this device.',
        });
      }
    } catch {
      setNotifFeedback({
        type: 'error',
        message: 'Error triggering test reminder.',
      });
    } finally {
      setIsBusyNotif(false);
    }
  };

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

      {/* Notifications & Reminders (Phase A5) */}
      <section id="notifications" className={styles.section}>
        <div className={styles.sectionTitle}>Notifications &amp; Reminders</div>
        <div className={styles.card}>
          {/* Device Reminders Toggle */}
          <div className={styles.row}>
            <div>
              <div
                className={styles.rowLabel}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Reminders on this device</span>
                <span
                  className={styles.statusBadge}
                  data-status={
                    permissionStatus === 'denied'
                      ? 'blocked'
                      : isSubscribed
                        ? 'active'
                        : 'off'
                  }
                >
                  {permissionStatus === 'denied'
                    ? 'Blocked'
                    : isSubscribed
                      ? 'Active'
                      : 'Off'}
                </span>
              </div>
              <div className={styles.rowDesc}>
                {permissionStatus === 'denied'
                  ? 'Notifications are blocked in your browser site settings. Allow notifications to receive dose alerts.'
                  : 'Receive push notifications when scheduled doses are due.'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isSubscribed}
              aria-label="Toggle reminders on this device"
              className={styles.toggle}
              data-checked={isSubscribed}
              onClick={handleToggleDeviceReminders}
              disabled={isBusyNotif || permissionStatus === 'denied'}
            >
              <div className={styles.toggleKnob} />
            </button>
          </div>

          {/* Privacy: Hide Medicine Names */}
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Hide medicine names on lock screen</div>
              <div className={styles.rowDesc}>
                Shows &ldquo;A dose is due&rdquo; instead of specific medicine names on notification
                banners.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hideNames}
              aria-label="Hide medicine names on lock screen"
              className={styles.toggle}
              data-checked={hideNames}
              onClick={handleToggleHideNames}
            >
              <div className={styles.toggleKnob} />
            </button>
          </div>

          {/* Care Profile Alert Preferences */}
          {activeCareProfile && (
            <div className={styles.prefGroup}>
              <div className={styles.prefGroupTitle}>
                Alert preferences for {activeCareProfile.name}
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={notifyDue}
                  onChange={(e) => handleUpdateAlertPref('due', e.target.checked)}
                />
                <span className={styles.checkboxLabel}>Dose due reminders</span>
              </label>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={notifyMissed}
                  onChange={(e) => handleUpdateAlertPref('missed', e.target.checked)}
                />
                <span className={styles.checkboxLabel}>Missed dose escalation alerts</span>
              </label>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={notifyExpiry}
                  onChange={(e) => handleUpdateAlertPref('expiry', e.target.checked)}
                />
                <span className={styles.checkboxLabel}>Low stock &amp; expiry warnings</span>
              </label>
            </div>
          )}

          {/* Send Test Reminder */}
          <button
            type="button"
            className={styles.testNotifBtn}
            onClick={handleSendTestReminder}
            disabled={isBusyNotif || !isSubscribed}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Send a test reminder</span>
          </button>

          {notifFeedback && (
            <div className={styles.feedbackBox} data-variant={notifFeedback.type}>
              {notifFeedback.message}
            </div>
          )}
        </div>
      </section>

      {/* App & Installation (Phase A5) */}
      <section id="install" className={styles.section}>
        <div className={styles.sectionTitle}>App &amp; Installation</div>
        <InstallCard />
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
