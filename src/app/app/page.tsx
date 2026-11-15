'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import {
  categorizeDoseEvents,
  formatHeaderDate,
  formatTimeInTz,
  FOOD_RULE_LABELS,
} from '@/features/schedules/schedule-utils';
import type { Database } from '@/lib/supabase/database.types';
import styles from './today.module.scss';
import medStyles from './medicine/[id]/medicine-detail.module.scss';

type Medicine = Database['public']['Tables']['medicines']['Row'];
type ScheduleTimeRow = Database['public']['Tables']['schedule_times']['Row'];
type ScheduleRow = Database['public']['Tables']['schedules']['Row'];
type DoseEventRow = Database['public']['Tables']['dose_events']['Row'];

interface EnrichedDoseEvent extends DoseEventRow {
  medicine?: Medicine | null;
  schedule_time?: ScheduleTimeRow | null;
  schedule?: ScheduleRow | null;
  is_snoozed?: boolean;
}

export default function TodayPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { activeCareProfile, isLoading: isProfileLoading } = useCareProfile();

  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  // As-needed log modal
  const [prnModalMed, setPrnModalMed] = useState<Medicine | null>(null);
  const [prnAmount, setPrnAmount] = useState<number | ''>(1);
  const [prnFeedback, setPrnFeedback] = useState<string | null>(null);
  const [isPrnSubmitting, setIsPrnSubmitting] = useState(false);

  const profileTz = activeCareProfile?.timezone || 'Asia/Kolkata';
  const missedAfterMinutes = activeCareProfile?.missed_after_minutes ?? 120;
  const snoozeMinutes = activeCareProfile?.snooze_minutes ?? 10;
  const activeProfileId = activeCareProfile?.id;

  const todayFormatted = useMemo(() => {
    return formatHeaderDate(profileTz);
  }, [profileTz]);

  // Query today's doses, medicines, schedules, and active stock
  const { data, isLoading: isDataLoading } = useQuery({
    queryKey: ['today-doses', activeProfileId],
    queryFn: async () => {
      if (!activeProfileId) {
        return { doses: [], medicines: [], asNeededMeds: [] };
      }

      // 48h UTC window around now captures today across all timezones
      const windowStart = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
      const windowEnd = new Date(Date.now() + 36 * 3600 * 1000).toISOString();

      const [dosesRes, medsRes, schedulesRes] = await Promise.all([
        supabase
          .from('dose_events')
          .select('*, schedule_times(*), schedules(*)')
          .eq('care_profile_id', activeProfileId)
          .or(`status.eq.pending,status.eq.missed,and(scheduled_for.gte.${windowStart},scheduled_for.lte.${windowEnd})`),
        supabase
          .from('medicines')
          .select('*')
          .eq('care_profile_id', activeProfileId)
          .is('archived_at', null),
        supabase
          .from('schedules')
          .select('*')
          .eq('care_profile_id', activeProfileId)
          .eq('active', true),
      ]);

      const medicines = (medsRes.data || []) as Medicine[];
      const medMap = new Map<string, Medicine>();
      for (const m of medicines) {
        medMap.set(m.id, m);
      }

      const schedules = (schedulesRes.data || []) as ScheduleRow[];
      const regularScheduledMedIds = new Set(
        schedules.filter((s) => s.frequency !== 'as_needed').map((s) => s.medicine_id),
      );

      // As-needed medicines are those with as_needed schedules or without fixed schedule
      const asNeededMeds = medicines.filter((m) => !regularScheduledMedIds.has(m.id));

      const rawDoses = (dosesRes.data || []) as (DoseEventRow & {
        schedule_times?: ScheduleTimeRow | null;
        schedules?: ScheduleRow | null;
      })[];

      const enrichedDoses: EnrichedDoseEvent[] = rawDoses.map((d) => ({
        ...d,
        medicine: medMap.get(d.medicine_id) || null,
        schedule_time: d.schedule_times || null,
        schedule: d.schedules || null,
      }));

      return {
        doses: enrichedDoses,
        medicines,
        asNeededMeds,
      };
    },
    enabled: Boolean(activeProfileId),
    refetchOnWindowFocus: true,
  });

  const { dueNow, laterToday, missed, doneToday } = useMemo(() => {
    const doses = data?.doses || [];
    return categorizeDoseEvents(doses, profileTz, missedAfterMinutes);
  }, [data?.doses, profileTz, missedAfterMinutes]);

  const asNeededMeds = data?.asNeededMeds || [];
  const totalDosesCount = dueNow.length + laterToday.length + missed.length + doneToday.length;

  // Actions
  const handleLogTaken = async (doseId: string) => {
    setActiveActionId(doseId);
    try {
      // Optimistic cache update
      queryClient.setQueryData(
        ['today-doses', activeProfileId],
        (old: { doses: EnrichedDoseEvent[]; medicines: Medicine[]; asNeededMeds: Medicine[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            doses: old.doses.map((d) =>
              d.id === doseId
                ? { ...d, status: 'taken' as const, taken_at: new Date().toISOString() }
                : d,
            ),
          };
        },
      );

      const { error } = await supabase.rpc('fn_log_dose', {
        p_event: doseId,
        p_status: 'taken',
        p_taken_at: new Date().toISOString(),
      });

      if (error) {
        await queryClient.invalidateQueries({ queryKey: ['today-doses', activeProfileId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['today-doses', activeProfileId] });
        await queryClient.invalidateQueries({ queryKey: ['cabinet'] });
        await queryClient.invalidateQueries({ queryKey: ['medicine-detail'] });
      }
    } finally {
      setActiveActionId(null);
    }
  };

  const handleLogSkip = async (doseId: string) => {
    setActiveActionId(doseId);
    try {
      // Optimistic update
      queryClient.setQueryData(
        ['today-doses', activeProfileId],
        (old: { doses: EnrichedDoseEvent[]; medicines: Medicine[]; asNeededMeds: Medicine[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            doses: old.doses.map((d) =>
              d.id === doseId ? { ...d, status: 'skipped' as const } : d,
            ),
          };
        },
      );

      const { error } = await supabase.rpc('fn_log_dose', {
        p_event: doseId,
        p_status: 'skipped',
      });

      if (error) {
        await queryClient.invalidateQueries({ queryKey: ['today-doses', activeProfileId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['today-doses', activeProfileId] });
      }
    } finally {
      setActiveActionId(null);
    }
  };

  const handleSnooze = async (doseId: string) => {
    setActiveActionId(doseId);
    try {
      const snoozedUntil = new Date(Date.now() + snoozeMinutes * 60000).toISOString();
      // Optimistic update
      queryClient.setQueryData(
        ['today-doses', activeProfileId],
        (old: { doses: EnrichedDoseEvent[]; medicines: Medicine[]; asNeededMeds: Medicine[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            doses: old.doses.map((d) =>
              d.id === doseId ? { ...d, snoozed_until: snoozedUntil } : d,
            ),
          };
        },
      );

      const { error } = await supabase.rpc('fn_snooze_dose', {
        p_event: doseId,
        p_minutes: snoozeMinutes,
      });

      if (error) {
        await queryClient.invalidateQueries({ queryKey: ['today-doses', activeProfileId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['today-doses', activeProfileId] });
      }
    } finally {
      setActiveActionId(null);
    }
  };

  const handleUndo = async (doseId: string) => {
    setActiveActionId(doseId);
    try {
      // Optimistic update
      queryClient.setQueryData(
        ['today-doses', activeProfileId],
        (old: { doses: EnrichedDoseEvent[]; medicines: Medicine[]; asNeededMeds: Medicine[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            doses: old.doses.map((d) =>
              d.id === doseId
                ? { ...d, status: 'pending' as const, taken_at: null, stock_shortfall: 0 }
                : d,
            ),
          };
        },
      );

      const { error } = await supabase.rpc('fn_undo_dose', {
        p_event: doseId,
      });

      if (error) {
        await queryClient.invalidateQueries({ queryKey: ['today-doses', activeProfileId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['today-doses', activeProfileId] });
        await queryClient.invalidateQueries({ queryKey: ['cabinet'] });
        await queryClient.invalidateQueries({ queryKey: ['medicine-detail'] });
      }
    } finally {
      setActiveActionId(null);
    }
  };

  // PRN Log Modal Submit
  const handleOpenPrnModal = (med: Medicine) => {
    setPrnModalMed(med);
    setPrnAmount(1);
    setPrnFeedback(null);
  };

  const handleSavePrnDose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prnModalMed) return;

    const amt = Number(prnAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPrnFeedback('Please enter a valid dose amount greater than 0.');
      return;
    }

    setIsPrnSubmitting(true);
    setPrnFeedback(null);

    try {
      const { error } = await supabase.rpc('fn_log_as_needed', {
        p_medicine: prnModalMed.id,
        p_amount: amt,
      });

      if (error) {
        setPrnFeedback('Could not record dose. Please try again.');
        setIsPrnSubmitting(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['today-doses', activeProfileId] });
      await queryClient.invalidateQueries({ queryKey: ['cabinet'] });
      await queryClient.invalidateQueries({ queryKey: ['medicine-detail'] });

      setIsPrnSubmitting(false);
      setPrnModalMed(null);
    } catch {
      setPrnFeedback('A network error occurred. Please try again.');
      setIsPrnSubmitting(false);
    }
  };

  if (isProfileLoading || isDataLoading) {
    return (
      <div className={styles.skeletonContainer} aria-busy="true" aria-label="Loading schedule">
        <div className={styles.skeletonBanner}>
          <div className={styles.shimmer} />
        </div>
        <div className={styles.skeletonCard}>
          <div className={styles.shimmer} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.todayContainer}>
      {/* Top Banner (Reminders status) */}
      <div className={styles.banner} role="status">
        <div className={styles.bannerContent}>
          <svg
            className={styles.bannerIcon}
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
          <span>Reminders are off for this browser.</span>
        </div>
        <Link href="/app/settings" className={styles.bannerBtn}>
          Enable
        </Link>
      </div>

      {/* Header Context */}
      <header className={styles.todayHeader}>
        <h1 className={styles.todayDate}>{todayFormatted}</h1>
        <p className={styles.todaySubtitle}>
          Medication schedule for {activeCareProfile?.name || 'today'}
        </p>
      </header>

      {/* If entirely empty */}
      {totalDosesCount === 0 && asNeededMeds.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconRing} aria-hidden="true">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
          </div>

          <h2 className={styles.emptyTitle}>
            No doses scheduled for {activeCareProfile?.name || 'today'}
          </h2>

          <p className={styles.emptyText}>
            Your medicine cabinet has no active schedules. Add your medicines and set times to
            receive calm daily reminders.
          </p>

          <Link href="/app/medicine/add" className={styles.addBtn}>
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
            <span>Add first medicine</span>
          </Link>
        </div>
      ) : (
        <div className={styles.sectionsList}>
          {/* 1. Due Now */}
          {dueNow.length > 0 && (
            <section className={styles.section} aria-label="Due now doses">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span>Due now</span>
                  <span className={styles.badgeCount} data-alert="true">
                    {dueNow.length}
                  </span>
                </h2>
              </div>

              <div className={styles.cardsList}>
                {dueNow.map((dose) => {
                  const med = dose.medicine;
                  const isActionBusy = activeActionId === dose.id;
                  const foodRule = dose.schedule_time?.food;

                  return (
                    <article
                      key={dose.id}
                      className={styles.doseCard}
                      data-status="due"
                    >
                      <div className={styles.doseCardTop}>
                        <div>
                          <h3 className={styles.medName}>
                            {med ? (
                              <Link
                                href={`/app/medicine/${med.id}`}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                              >
                                {med.name}
                              </Link>
                            ) : (
                              'Medicine'
                            )}
                          </h3>
                          <div className={styles.medStrength}>
                            {med?.strength ? `${med.strength} · ` : ''}
                            {dose.amount} {med?.unit || 'units'}
                          </div>
                        </div>

                        <span className={styles.timeTag}>
                          {formatTimeInTz(dose.scheduled_for, profileTz)}
                        </span>
                      </div>

                      <div className={styles.metaRow}>
                        {foodRule && foodRule !== 'any' && (
                          <span className={styles.foodBadge}>
                            {FOOD_RULE_LABELS[foodRule]}
                          </span>
                        )}
                        {dose.schedule?.instructions && (
                          <span className={styles.instructionNote}>
                            {dose.schedule.instructions}
                          </span>
                        )}
                      </div>

                      <div className={styles.actionsRow}>
                        <button
                          type="button"
                          className={styles.takenBtn}
                          onClick={() => handleLogTaken(dose.id)}
                          disabled={isActionBusy}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Taken</span>
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryActionBtn}
                          onClick={() => handleSnooze(dose.id)}
                          disabled={isActionBusy}
                        >
                          Snooze ({snoozeMinutes}m)
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryActionBtn}
                          onClick={() => handleLogSkip(dose.id)}
                          disabled={isActionBusy}
                        >
                          Skip
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. Later Today */}
          {laterToday.length > 0 && (
            <section className={styles.section} aria-label="Later today doses">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span>Later today</span>
                  <span className={styles.badgeCount}>{laterToday.length}</span>
                </h2>
              </div>

              <div className={styles.cardsList}>
                {laterToday.map((dose) => {
                  const med = dose.medicine;
                  const isActionBusy = activeActionId === dose.id;
                  const foodRule = dose.schedule_time?.food;
                  const isSnoozed = dose.is_snoozed;

                  return (
                    <article
                      key={dose.id}
                      className={styles.doseCard}
                    >
                      <div className={styles.doseCardTop}>
                        <div>
                          <h3 className={styles.medName}>
                            {med ? (
                              <Link
                                href={`/app/medicine/${med.id}`}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                              >
                                {med.name}
                              </Link>
                            ) : (
                              'Medicine'
                            )}
                          </h3>
                          <div className={styles.medStrength}>
                            {med?.strength ? `${med.strength} · ` : ''}
                            {dose.amount} {med?.unit || 'units'}
                          </div>
                        </div>

                        <span className={styles.timeTag}>
                          {formatTimeInTz(dose.scheduled_for, profileTz)}
                        </span>
                      </div>

                      <div className={styles.metaRow}>
                        {isSnoozed && (
                          <span className={styles.snoozeBadge}>
                            Snoozed until {formatTimeInTz(dose.snoozed_until!, profileTz)}
                          </span>
                        )}
                        {foodRule && foodRule !== 'any' && (
                          <span className={styles.foodBadge}>
                            {FOOD_RULE_LABELS[foodRule]}
                          </span>
                        )}
                        {dose.schedule?.instructions && (
                          <span className={styles.instructionNote}>
                            {dose.schedule.instructions}
                          </span>
                        )}
                      </div>

                      <div className={styles.actionsRow}>
                        <button
                          type="button"
                          className={styles.takenBtn}
                          onClick={() => handleLogTaken(dose.id)}
                          disabled={isActionBusy}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Taken early</span>
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryActionBtn}
                          onClick={() => handleLogSkip(dose.id)}
                          disabled={isActionBusy}
                        >
                          Skip
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* 3. Missed */}
          {missed.length > 0 && (
            <section className={styles.section} aria-label="Missed doses">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span style={{ color: '#f87171' }}>Missed</span>
                  <span className={styles.badgeCount} data-alert="true">
                    {missed.length}
                  </span>
                </h2>
              </div>

              <div className={styles.cardsList}>
                {missed.map((dose) => {
                  const med = dose.medicine;
                  const isActionBusy = activeActionId === dose.id;

                  return (
                    <article
                      key={dose.id}
                      className={styles.doseCard}
                      data-status="missed"
                    >
                      <div className={styles.doseCardTop}>
                        <div>
                          <h3 className={styles.medName}>
                            {med ? (
                              <Link
                                href={`/app/medicine/${med.id}`}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                              >
                                {med.name}
                              </Link>
                            ) : (
                              'Medicine'
                            )}
                          </h3>
                          <div className={styles.medStrength}>
                            {med?.strength ? `${med.strength} · ` : ''}
                            {dose.amount} {med?.unit || 'units'}
                          </div>
                        </div>

                        <span className={styles.timeTag} style={{ color: '#fca5a5' }}>
                          Due {formatTimeInTz(dose.scheduled_for, profileTz)}
                        </span>
                      </div>

                      <div className={styles.actionsRow}>
                        <button
                          type="button"
                          className={styles.takenBtn}
                          onClick={() => handleLogTaken(dose.id)}
                          disabled={isActionBusy}
                        >
                          <span>Take late</span>
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryActionBtn}
                          onClick={() => handleLogSkip(dose.id)}
                          disabled={isActionBusy}
                        >
                          Skip dose
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* 4. Done Today */}
          {doneToday.length > 0 && (
            <section className={styles.section} aria-label="Done today doses">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span>Done today</span>
                  <span className={styles.badgeCount}>{doneToday.length}</span>
                </h2>
              </div>

              <div className={styles.cardsList}>
                {doneToday.map((dose) => {
                  const med = dose.medicine;
                  const isActionBusy = activeActionId === dose.id;
                  const isTaken = dose.status === 'taken';
                  const hasShortfall = dose.stock_shortfall && dose.stock_shortfall > 0;

                  return (
                    <article
                      key={dose.id}
                      className={styles.doseCard}
                      data-status="taken"
                    >
                      <div className={styles.doseCardTop}>
                        <div>
                          <h3 className={styles.medName} style={{ opacity: 0.9 }}>
                            {med ? (
                              <Link
                                href={`/app/medicine/${med.id}`}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                              >
                                {med.name}
                              </Link>
                            ) : (
                              'Medicine'
                            )}
                          </h3>
                          <div className={styles.medStrength}>
                            {med?.strength ? `${med.strength} · ` : ''}
                            {dose.amount} {med?.unit || 'units'} ·{' '}
                            <span style={{ color: isTaken ? '#34d399' : 'var(--muted)' }}>
                              {isTaken
                                ? `Taken ${dose.taken_at ? formatTimeInTz(dose.taken_at, profileTz) : ''}`
                                : 'Skipped'}
                            </span>
                            {dose.as_needed ? ' · As needed' : ''}
                          </div>
                        </div>

                        <button
                          type="button"
                          className={styles.undoBtn}
                          onClick={() => handleUndo(dose.id)}
                          disabled={isActionBusy}
                          aria-label={`Undo ${med?.name || 'dose'}`}
                        >
                          Undo
                        </button>
                      </div>

                      {hasShortfall && (
                        <div className={styles.shortfallAlert} role="status">
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
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>Logged. You may be out of this medicine.</span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* 5. As Needed (PRN) */}
          {asNeededMeds.length > 0 && (
            <section className={styles.section} aria-label="As needed medicines">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span>As needed</span>
                  <span className={styles.badgeCount}>{asNeededMeds.length}</span>
                </h2>
              </div>

              <div className={styles.cardsList}>
                {asNeededMeds.map((med) => (
                  <div key={med.id} className={styles.asNeededCard}>
                    <div className={styles.asNeededInfo}>
                      <h3 className={styles.medName}>
                        <Link
                          href={`/app/medicine/${med.id}`}
                          style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                          {med.name}
                        </Link>
                      </h3>
                      <div className={styles.medStrength}>
                        {med.strength ? `${med.strength} · ` : ''}
                        {med.form}
                        {med.purpose ? ` · ${med.purpose}` : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.logPrnBtn}
                      onClick={() => handleOpenPrnModal(med)}
                    >
                      Log a dose
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Log As-Needed Modal */}
      {prnModalMed && (
        <div
          className={medStyles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-prn-title"
        >
          <form onSubmit={handleSavePrnDose} className={medStyles.modalCard} noValidate>
            <h3 id="modal-prn-title" className={medStyles.modalTitle}>
              Log {prnModalMed.name}
            </h3>
            <p className={medStyles.modalBody}>
              Record an as-needed dose taken now. Inventory will be automatically deducted from the
              earliest-expiring box.
            </p>

            <div className={medStyles.inputGroup}>
              <label htmlFor="prn-amount-input" className={medStyles.label}>
                Amount taken ({prnModalMed.unit}) *
              </label>
              <input
                id="prn-amount-input"
                type="number"
                min="0.25"
                step="any"
                className={medStyles.input}
                value={prnAmount}
                onChange={(e) =>
                  setPrnAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                required
                autoFocus
              />
            </div>

            {prnFeedback && (
              <div style={{ color: '#fca5a5', fontSize: '0.875rem' }}>{prnFeedback}</div>
            )}

            <div className={medStyles.modalButtons}>
              <button
                type="button"
                className={medStyles.cancelModalBtn}
                onClick={() => setPrnModalMed(null)}
                disabled={isPrnSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={medStyles.confirmModalBtn}
                disabled={isPrnSubmitting}
              >
                {isPrnSubmitting ? 'Logging…' : 'Log dose'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
