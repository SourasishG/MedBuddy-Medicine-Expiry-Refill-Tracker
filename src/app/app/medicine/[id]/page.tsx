'use client';

import { use, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import {
  getExpiryMeta,
  formatRefillHint,
  parseExpiryInput,
  isPastExpiry,
} from '@/features/medicines/expiry-utils';
import {
  DAYS_OF_WEEK,
  FOOD_RULE_LABELS,
  formatClockTime,
  formatScheduleSummary,
  formatTimeInTz,
  getTodayDateString,
  type ScheduleTimeItem,
} from '@/features/schedules/schedule-utils';
import { replaceScheduleTimesAtomic } from '@/features/schedules/schedule-replace-utils';
import type { Database } from '@/lib/supabase/database.types';
import styles from './medicine-detail.module.scss';
import todayStyles from '../../today.module.scss';
import addStyles from '../add/add-medicine.module.scss';

type Medicine = Database['public']['Tables']['medicines']['Row'];
type InventoryStatusRow = Database['public']['Views']['inventory_status']['Row'];
type MedicineSupplyRow = Database['public']['Views']['medicine_supply']['Row'];
type MedicineForm = Database['public']['Enums']['medicine_form'];
type FoodRule = Database['public']['Enums']['food_rule'];
type ScheduleRow = Database['public']['Tables']['schedules']['Row'];
type ScheduleTimeRow = Database['public']['Tables']['schedule_times']['Row'];
type DoseEventRow = Database['public']['Tables']['dose_events']['Row'];

interface ScheduleWithTimes extends ScheduleRow {
  schedule_times: ScheduleTimeRow[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MedicineDetailPage({ params }: PageProps) {
  const { id: medicineId } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { activeCareProfile, isLoading: isProfileLoading } = useCareProfile();

  // Active modals
  const [isEditMedOpen, setIsEditMedOpen] = useState(false);
  const [isAddBoxOpen, setIsAddBoxOpen] = useState(false);
  const [adjustingBox, setAdjustingBox] = useState<InventoryStatusRow | null>(null);
  const [discardingBox, setDiscardingBox] = useState<InventoryStatusRow | null>(null);
  const [isDeleteMedOpen, setIsDeleteMedOpen] = useState(false);
  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);

  // Edit medicine form state
  const [editName, setEditName] = useState('');
  const [editStrength, setEditStrength] = useState('');
  const [editForm, setEditForm] = useState<MedicineForm>('tablet');
  const [editUnit, setEditUnit] = useState('tablets');
  const [editPurpose, setEditPurpose] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Add box form state
  const [newBoxQty, setNewBoxQty] = useState<number | ''>(30);
  const [newBoxExpiry, setNewBoxExpiry] = useState('');
  const [newBoxBatch, setNewBoxBatch] = useState('');
  const [newBoxLocation, setNewBoxLocation] = useState('');
  const [newBoxOpenedOn, setNewBoxOpenedOn] = useState('');
  const [newBoxConfirmExpired, setNewBoxConfirmExpired] = useState(false);

  // Adjust stock form state
  const [adjustDelta, setAdjustDelta] = useState<number | ''>('');

  // Schedule modal form state
  const [schedFrequency, setSchedFrequency] = useState<
    'daily' | 'weekdays' | 'interval' | 'as_needed'
  >('daily');
  const [schedWeekdays, setSchedWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [schedInterval, setSchedInterval] = useState<number | ''>(2);
  const [schedDoseAmount, setSchedDoseAmount] = useState<number | ''>(1);
  const [schedTimes, setSchedTimes] = useState<ScheduleTimeItem[]>([
    { time: '08:00', food: 'any' },
  ]);
  const [schedStartDate, setSchedStartDate] = useState('');
  const [schedEndDate, setSchedEndDate] = useState('');
  const [schedInstructions, setSchedInstructions] = useState('');

  // Async action feedback
  const [modalFeedback, setModalFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [pageFeedback, setPageFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const profileTz = activeCareProfile?.timezone || 'Asia/Kolkata';

  // Fetch medicine, boxes, supply, schedule, and recent doses
  const { data, isLoading: isDataLoading } = useQuery({
    queryKey: ['medicine-detail', medicineId],
    queryFn: async () => {
      const [medRes, boxesRes, supplyRes, schedRes, dosesRes] = await Promise.all([
        supabase
          .from('medicines')
          .select('*')
          .eq('id', medicineId)
          .is('archived_at', null)
          .single(),
        supabase
          .from('inventory_status')
          .select('*')
          .eq('medicine_id', medicineId)
          .eq('status', 'active'),
        supabase.from('medicine_supply').select('*').eq('medicine_id', medicineId).maybeSingle(),
        supabase
          .from('schedules')
          .select('*, schedule_times(*)')
          .eq('medicine_id', medicineId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('dose_events')
          .select('*')
          .eq('medicine_id', medicineId)
          .order('scheduled_for', { ascending: false })
          .limit(10),
      ]);

      if (medRes.error || !medRes.data) {
        throw new Error('Medicine not found or access denied.');
      }

      const boxes = (boxesRes.data || []) as InventoryStatusRow[];
      boxes.sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));

      return {
        medicine: medRes.data as Medicine,
        boxes,
        supply: supplyRes.data as MedicineSupplyRow | null,
        schedule: schedRes.data as ScheduleWithTimes | null,
        recentDoses: (dosesRes.data || []) as DoseEventRow[],
      };
    },
    enabled: Boolean(medicineId),
  });

  const medicine = data?.medicine;
  const boxes = useMemo(() => data?.boxes || [], [data?.boxes]);
  const supply = data?.supply;
  const schedule = data?.schedule;
  const recentDoses = useMemo(() => data?.recentDoses || [], [data?.recentDoses]);

  const totalRemaining = useMemo(() => {
    return supply?.remaining ?? boxes.reduce((acc, b) => acc + (b.quantity_remaining || 0), 0);
  }, [supply, boxes]);

  const refillHint = useMemo(() => {
    if (!medicine) return '';
    return formatRefillHint({
      remaining: totalRemaining,
      dailyUsage: supply?.daily_usage,
      daysOfSupply: supply?.days_of_supply,
      unit: medicine.unit,
    });
  }, [medicine, totalRemaining, supply]);

  // Open edit modal pre-filled with medicine data
  const handleOpenEditMed = () => {
    if (!medicine) return;
    setEditName(medicine.name);
    setEditStrength(medicine.strength || '');
    setEditForm(medicine.form);
    setEditUnit(medicine.unit);
    setEditPurpose(medicine.purpose || '');
    setEditNotes(medicine.notes || '');
    setModalFeedback(null);
    setIsEditMedOpen(true);
  };

  const handleSaveMedEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicine) return;

    const cleanName = editName.trim();
    if (!cleanName) {
      setModalFeedback({ type: 'error', message: 'Medicine name cannot be empty.' });
      return;
    }

    setIsActionLoading(true);
    setModalFeedback(null);

    try {
      const { error } = await supabase
        .from('medicines')
        .update({
          name: cleanName,
          strength: editStrength.trim() || null,
          form: editForm,
          unit: editUnit.trim() || 'tablets',
          purpose: editPurpose.trim() || null,
          notes: editNotes.trim() || null,
        })
        .eq('id', medicine.id);

      if (error) {
        setModalFeedback({
          type: 'error',
          message: 'Could not update medicine. Please try again.',
        });
        setIsActionLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['medicine-detail', medicineId] });
      await queryClient.invalidateQueries({ queryKey: ['cabinet'] });
      setIsActionLoading(false);
      setIsEditMedOpen(false);
    } catch {
      setModalFeedback({ type: 'error', message: 'A network error occurred. Please try again.' });
      setIsActionLoading(false);
    }
  };

  // Add Box Modal Action
  const handleOpenAddBox = () => {
    setNewBoxQty(30);
    setNewBoxExpiry('');
    setNewBoxBatch('');
    setNewBoxLocation('');
    setNewBoxOpenedOn('');
    setNewBoxConfirmExpired(false);
    setModalFeedback(null);
    setIsAddBoxOpen(true);
  };

  const parsedNewBoxExpiry = useMemo(() => {
    return parseExpiryInput(newBoxExpiry);
  }, [newBoxExpiry]);

  const isNewBoxExpired = useMemo(() => {
    if (!parsedNewBoxExpiry || !/^\d{4}-\d{2}-\d{2}$/.test(parsedNewBoxExpiry)) return false;
    return isPastExpiry(parsedNewBoxExpiry, profileTz);
  }, [parsedNewBoxExpiry, profileTz]);

  const handleSaveNewBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicine || !activeCareProfile) return;

    const qty = Number(newBoxQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setModalFeedback({
        type: 'error',
        message: 'Please enter a valid quantity greater than 0.',
      });
      return;
    }

    const finalExpiry = parseExpiryInput(newBoxExpiry);
    if (!finalExpiry || !/^\d{4}-\d{2}-\d{2}$/.test(finalExpiry)) {
      setModalFeedback({
        type: 'error',
        message: 'Please enter a valid expiry date (e.g. YYYY-MM or YYYY-MM-DD).',
      });
      return;
    }

    if (isNewBoxExpired && !newBoxConfirmExpired) {
      setModalFeedback({
        type: 'error',
        message: 'This date has already passed. Please confirm below that this box is expired.',
      });
      return;
    }

    setIsActionLoading(true);
    setModalFeedback(null);

    try {
      const { error } = await supabase.from('inventory_items').insert({
        medicine_id: medicine.id,
        care_profile_id: activeCareProfile.id,
        quantity_initial: qty,
        expiry_date: finalExpiry,
        batch_no: newBoxBatch.trim() || null,
        storage_location: newBoxLocation.trim() || null,
        opened_on: newBoxOpenedOn.trim() || null,
      });

      if (error) {
        setModalFeedback({
          type: 'error',
          message: 'Could not record box. Please verify date and permissions.',
        });
        setIsActionLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['medicine-detail', medicineId] });
      await queryClient.invalidateQueries({ queryKey: ['cabinet'] });
      setIsActionLoading(false);
      setIsAddBoxOpen(false);
    } catch {
      setModalFeedback({ type: 'error', message: 'A network error occurred. Please try again.' });
      setIsActionLoading(false);
    }
  };

  // Adjust Stock Modal Action
  const handleOpenAdjust = (box: InventoryStatusRow) => {
    setAdjustingBox(box);
    setAdjustDelta('');
    setModalFeedback(null);
  };

  const handleSaveAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingBox) return;

    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      setModalFeedback({
        type: 'error',
        message: 'Please enter a non-zero adjustment delta (e.g. -1 or 5).',
      });
      return;
    }

    setIsActionLoading(true);
    setModalFeedback(null);

    try {
      const { error } = await supabase.rpc('fn_adjust_stock', {
        p_item: adjustingBox.id,
        p_delta: delta,
      });

      if (error) {
        setModalFeedback({
          type: 'error',
          message: 'Could not adjust stock. Please verify permissions.',
        });
        setIsActionLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['medicine-detail', medicineId] });
      await queryClient.invalidateQueries({ queryKey: ['cabinet'] });
      setIsActionLoading(false);
      setAdjustingBox(null);
    } catch {
      setModalFeedback({ type: 'error', message: 'A network error occurred. Please try again.' });
      setIsActionLoading(false);
    }
  };

  // Discard Box Modal Action
  const handleOpenDiscard = (box: InventoryStatusRow) => {
    setDiscardingBox(box);
    setModalFeedback(null);
  };

  const handleConfirmDiscardBox = async () => {
    if (!discardingBox) return;

    setIsActionLoading(true);
    setModalFeedback(null);

    try {
      const { error } = await supabase.rpc('fn_discard_item', {
        p_item: discardingBox.id,
      });

      if (error) {
        setModalFeedback({
          type: 'error',
          message: 'Could not discard box. Please try again.',
        });
        setIsActionLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['medicine-detail', medicineId] });
      await queryClient.invalidateQueries({ queryKey: ['cabinet'] });
      setIsActionLoading(false);
      setDiscardingBox(null);
    } catch {
      setModalFeedback({ type: 'error', message: 'A network error occurred. Please try again.' });
      setIsActionLoading(false);
    }
  };

  // Schedule Open/Save Actions
  const handleOpenEditSchedule = () => {
    if (schedule) {
      setSchedFrequency(schedule.frequency);
      setSchedWeekdays(schedule.days_of_week || [1, 2, 3, 4, 5, 6, 7]);
      setSchedInterval(schedule.interval_days || 2);
      setSchedDoseAmount(schedule.dose_amount);
      const timesList = (schedule.schedule_times || []).map((t) => ({
        time: t.time_of_day.slice(0, 5),
        food: t.food as FoodRule,
      }));
      setSchedTimes(timesList.length > 0 ? timesList : [{ time: '08:00', food: 'any' }]);
      setSchedStartDate(schedule.start_date);
      setSchedEndDate(schedule.end_date || '');
      setSchedInstructions(schedule.instructions || '');
    } else {
      setSchedFrequency('daily');
      setSchedWeekdays([1, 2, 3, 4, 5, 6, 7]);
      setSchedInterval(2);
      setSchedDoseAmount(1);
      setSchedTimes([{ time: '08:00', food: 'any' }]);
      setSchedStartDate(getTodayDateString(profileTz));
      setSchedEndDate('');
      setSchedInstructions('');
    }
    setModalFeedback(null);
    setIsEditScheduleOpen(true);
  };

  const handleToggleWeekday = (dayId: number) => {
    setSchedWeekdays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort(),
    );
  };

  const handleAddTime = () => {
    setSchedTimes((prev) => [...prev, { time: '20:00', food: 'any' }]);
  };

  const handleRemoveTime = (index: number) => {
    setSchedTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTimeChange = (index: number, newTime: string) => {
    setSchedTimes((prev) =>
      prev.map((item, i) => (i === index ? { ...item, time: newTime } : item)),
    );
  };

  const handleFoodChange = (index: number, food: FoodRule) => {
    setSchedTimes((prev) => prev.map((item, i) => (i === index ? { ...item, food } : item)));
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicine || !activeCareProfile) return;

    if (schedFrequency === 'weekdays' && schedWeekdays.length === 0) {
      setModalFeedback({ type: 'error', message: 'Please select at least one day of the week.' });
      return;
    }

    if (schedFrequency === 'interval') {
      const intVal = Number(schedInterval);
      if (!Number.isFinite(intVal) || intVal < 2 || intVal > 365) {
        setModalFeedback({ type: 'error', message: 'Interval days must be between 2 and 365.' });
        return;
      }
    }

    if (
      schedFrequency !== 'as_needed' &&
      (schedTimes.length === 0 || schedTimes.some((t) => !t.time))
    ) {
      setModalFeedback({
        type: 'error',
        message: 'Please specify at least one valid time of day.',
      });
      return;
    }

    const cleanDoseAmt =
      typeof schedDoseAmount === 'number' && schedDoseAmount > 0 ? schedDoseAmount : 1;
    const cleanStartDate = schedStartDate || getTodayDateString(profileTz);
    const cleanEndDate = schedEndDate.trim() || null;

    setIsActionLoading(true);
    setModalFeedback(null);

    try {
      let targetScheduleId = schedule?.id;

      if (schedule) {
        // Update existing schedule
        const { error: updErr } = await supabase
          .from('schedules')
          .update({
            frequency: schedFrequency,
            days_of_week: schedFrequency === 'weekdays' ? schedWeekdays : null,
            interval_days: schedFrequency === 'interval' ? Number(schedInterval) : null,
            start_date: cleanStartDate,
            end_date: cleanEndDate,
            dose_amount: cleanDoseAmt,
            instructions: schedInstructions.trim() || null,
          })
          .eq('id', schedule.id);

        if (updErr) {
          setModalFeedback({
            type: 'error',
            message: 'Could not update schedule details. Please try again.',
          });
          setIsActionLoading(false);
          return;
        }

        // Atomically replace schedule times (insert new first, update existing, delete obsolete only after insert succeeds, and resync)
        const targetTimes =
          schedFrequency !== 'as_needed'
            ? schedTimes.map((t) => ({
                time: t.time,
                food: t.food,
                dose_amount: cleanDoseAmt,
              }))
            : [];

        const replaceResult = await replaceScheduleTimesAtomic({
          supabase,
          scheduleId: schedule.id,
          careProfileId: activeCareProfile.id,
          targetTimes,
          defaultDoseAmount: cleanDoseAmt,
        });

        if (!replaceResult.success) {
          setModalFeedback({
            type: 'error',
            message: replaceResult.error || 'Could not update schedule times.',
          });
          setIsActionLoading(false);
          return;
        }
      } else {
        // Insert new schedule
        const { data: newSched, error: insErr } = await supabase
          .from('schedules')
          .insert({
            care_profile_id: activeCareProfile.id,
            medicine_id: medicine.id,
            frequency: schedFrequency,
            days_of_week: schedFrequency === 'weekdays' ? schedWeekdays : null,
            interval_days: schedFrequency === 'interval' ? Number(schedInterval) : null,
            start_date: cleanStartDate,
            end_date: cleanEndDate,
            dose_amount: cleanDoseAmt,
            instructions: schedInstructions.trim() || null,
            active: true,
          })
          .select('id')
          .single();

        if (insErr || !newSched) {
          setModalFeedback({
            type: 'error',
            message: 'Could not create schedule. Please try again.',
          });
          setIsActionLoading(false);
          return;
        }
        targetScheduleId = newSched.id;

        if (schedFrequency !== 'as_needed' && targetScheduleId) {
          const targetTimes = schedTimes.map((t) => ({
            time: t.time,
            food: t.food,
            dose_amount: cleanDoseAmt,
          }));

          const replaceResult = await replaceScheduleTimesAtomic({
            supabase,
            scheduleId: targetScheduleId,
            careProfileId: activeCareProfile.id,
            targetTimes,
            defaultDoseAmount: cleanDoseAmt,
          });

          if (!replaceResult.success) {
            setModalFeedback({
              type: 'error',
              message: replaceResult.error || 'Could not save schedule times.',
            });
            setIsActionLoading(false);
            return;
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['medicine-detail', medicineId] });
      await queryClient.invalidateQueries({ queryKey: ['today-doses'] });
      setIsActionLoading(false);
      setIsEditScheduleOpen(false);
      setPageFeedback({ type: 'success', message: 'Schedule updated successfully.' });
    } catch {
      setModalFeedback({
        type: 'error',
        message: 'An unexpected error occurred while saving the schedule. Please try again.',
      });
      setIsActionLoading(false);
    }
  };

  const handleTogglePauseSchedule = async () => {
    if (!schedule) return;
    setIsActionLoading(true);
    setPageFeedback(null);
    try {
      const newActive = !schedule.active;
      const { error: updErr } = await supabase
        .from('schedules')
        .update({ active: newActive })
        .eq('id', schedule.id);

      if (updErr) {
        setPageFeedback({
          type: 'error',
          message: 'Could not update schedule status. Please try again.',
        });
        setIsActionLoading(false);
        return;
      }

      const { error: rpcErr } = await supabase.rpc('fn_resync_schedule', {
        p_schedule: schedule.id,
      });

      if (rpcErr) {
        setPageFeedback({
          type: 'error',
          message:
            'Schedule status was updated, but could not refresh upcoming doses. Please click "Resync future doses".',
        });
        setIsActionLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['medicine-detail', medicineId] });
      await queryClient.invalidateQueries({ queryKey: ['today-doses'] });
      setPageFeedback({
        type: 'success',
        message: newActive
          ? 'Schedule resumed and future doses refreshed.'
          : 'Schedule paused and upcoming doses removed.',
      });
      setIsActionLoading(false);
    } catch {
      setPageFeedback({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.',
      });
      setIsActionLoading(false);
    }
  };

  const handleResyncSchedule = async () => {
    if (!schedule) return;
    setIsActionLoading(true);
    setPageFeedback(null);
    try {
      const { error: rpcErr } = await supabase.rpc('fn_resync_schedule', {
        p_schedule: schedule.id,
      });

      if (rpcErr) {
        setPageFeedback({
          type: 'error',
          message: 'Could not refresh upcoming doses. Please try again.',
        });
        setIsActionLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['medicine-detail', medicineId] });
      await queryClient.invalidateQueries({ queryKey: ['today-doses'] });
      setPageFeedback({
        type: 'success',
        message: 'Schedule resynced. Future doses refreshed.',
      });
      setIsActionLoading(false);
    } catch {
      setPageFeedback({
        type: 'error',
        message: 'An unexpected error occurred while resyncing.',
      });
      setIsActionLoading(false);
    }
  };

  // Delete Medicine Modal Action
  const handleConfirmDeleteMed = async () => {
    if (!medicine) return;

    setIsActionLoading(true);
    setModalFeedback(null);

    try {
      const { error } = await supabase
        .from('medicines')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', medicine.id);

      if (error) {
        setModalFeedback({
          type: 'error',
          message: 'Could not delete medicine. Please try again.',
        });
        setIsActionLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['cabinet'] });
      await queryClient.invalidateQueries({ queryKey: ['today-doses'] });
      router.replace('/app/cabinet');
    } catch {
      setModalFeedback({ type: 'error', message: 'A network error occurred. Please try again.' });
      setIsActionLoading(false);
    }
  };

  if (isProfileLoading || isDataLoading) {
    return (
      <div
        className={todayStyles.skeletonContainer}
        aria-busy="true"
        aria-label="Loading medicine details"
      >
        <div className={todayStyles.skeletonCard}>
          <div className={todayStyles.shimmer} />
        </div>
      </div>
    );
  }

  if (!medicine) {
    return (
      <div className={styles.container}>
        <div className={styles.medDetailNote}>
          Medicine not found or access denied.{' '}
          <Link href="/app/cabinet" style={{ color: 'var(--accent)' }}>
            Return to Cabinet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <nav className={styles.headerNav}>
        <Link href="/app/cabinet" className={styles.backBtn}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Cabinet</span>
        </Link>
      </nav>

      {pageFeedback && (
        <div
          className={styles.feedbackBox}
          data-variant={pageFeedback.type}
          role={pageFeedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span>{pageFeedback.message}</span>
          <button
            type="button"
            className={styles.feedbackDismissBtn}
            onClick={() => setPageFeedback(null)}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Medicine Header Card */}
      <section className={styles.medHeaderCard}>
        <div className={styles.medTitleRow}>
          <div>
            <h1 className={styles.medName}>{medicine.name}</h1>
            <div className={styles.medStrength}>
              {medicine.strength ? `${medicine.strength} · ` : ''}
              {medicine.form}
            </div>
          </div>
          <button type="button" className={styles.editBtn} onClick={handleOpenEditMed}>
            Edit details
          </button>
        </div>

        <div className={styles.medStatsRow}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total remaining</span>
            <span className={styles.statValue}>
              {totalRemaining} {medicine.unit}
            </span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statLabel}>Active packages</span>
            <span className={styles.statValue}>
              {boxes.length} {boxes.length === 1 ? 'box' : 'boxes'}
            </span>
          </div>
        </div>

        <div className={styles.refillAlert}>{refillHint}</div>

        {medicine.purpose && (
          <div className={styles.medDetailNote}>
            <strong>Purpose:</strong> {medicine.purpose}
          </div>
        )}

        {medicine.notes && (
          <div className={styles.medDetailNote}>
            <strong>Notes:</strong> {medicine.notes}
          </div>
        )}
      </section>

      {/* Packages & Boxes List */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Packages &amp; Boxes</h2>
        </div>

        <div className={styles.boxesList} style={{ marginTop: '12px' }}>
          {boxes.map((box) => {
            const daysLeft = box.days_left ?? null;
            const expiryMeta = daysLeft !== null ? getExpiryMeta(daysLeft) : null;

            return (
              <div key={box.id} className={styles.boxCard} data-testid="box-card">
                <div className={styles.boxCardTop}>
                  <div>
                    <div className={styles.boxQuantity}>
                      {box.quantity_remaining} / {box.quantity_initial} {box.unit}
                    </div>
                    {box.storage_location && (
                      <div className={styles.boxLocation}>Location: {box.storage_location}</div>
                    )}
                    {box.batch_no && (
                      <div className={styles.boxLocation}>Batch #{box.batch_no}</div>
                    )}
                  </div>

                  {expiryMeta && (
                    <span className={styles.badge} data-band={expiryMeta.band}>
                      {expiryMeta.label} · {expiryMeta.humanText}
                    </span>
                  )}
                </div>

                <div className={styles.boxDatesRow}>
                  <span>Expires: {box.expiry_date}</span>
                  {box.opened_on && <span>Opened: {box.opened_on}</span>}
                  {box.effective_expiry && box.effective_expiry !== box.expiry_date && (
                    <span>Effective: {box.effective_expiry}</span>
                  )}
                </div>

                <div className={styles.boxActionsRow}>
                  <button
                    type="button"
                    className={styles.smallActionBtn}
                    onClick={() => handleOpenAdjust(box)}
                  >
                    Adjust stock
                  </button>
                  <button
                    type="button"
                    className={styles.smallActionBtn}
                    data-danger="true"
                    onClick={() => handleOpenDiscard(box)}
                  >
                    Discard box
                  </button>
                </div>
              </div>
            );
          })}

          <button type="button" className={styles.addBoxBtn} onClick={handleOpenAddBox}>
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
            <span>Add another box</span>
          </button>
        </div>
      </section>

      {/* Schedule & Reminders Section */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Schedule &amp; Reminders</h2>
          <button type="button" className={styles.editBtn} onClick={handleOpenEditSchedule}>
            {schedule ? 'Edit schedule' : '+ Set schedule'}
          </button>
        </div>

        <div style={{ marginTop: '12px' }}>
          {schedule ? (
            <div className={styles.scheduleCard}>
              <div className={styles.scheduleCardHeader}>
                <h3 className={styles.scheduleSummary}>
                  {formatScheduleSummary(
                    schedule.frequency,
                    schedule.schedule_times,
                    schedule.days_of_week,
                    schedule.interval_days,
                  )}
                </h3>
                <span className={styles.scheduleStatusBadge} data-active={schedule.active}>
                  {schedule.active ? 'Active' : 'Paused'}
                </span>
              </div>

              <div className={styles.scheduleDetailsList}>
                <div>
                  <strong>Dose amount:</strong> {schedule.dose_amount} {medicine.unit}
                </div>
                {schedule.start_date && (
                  <div>
                    <strong>Started:</strong> {schedule.start_date}
                    {schedule.end_date ? ` (ends ${schedule.end_date})` : ''}
                  </div>
                )}
                {schedule.instructions && (
                  <div>
                    <strong>Instructions:</strong> {schedule.instructions}
                  </div>
                )}
              </div>

              {schedule.schedule_times && schedule.schedule_times.length > 0 && (
                <div>
                  <span className={styles.statLabel}>Scheduled times:</span>
                  <div className={styles.scheduleTimesGrid}>
                    {schedule.schedule_times.map((st) => (
                      <div key={st.id} className={styles.timePill}>
                        <span>{formatClockTime(st.time_of_day)}</span>
                        {st.food && st.food !== 'any' && (
                          <span data-food="true">{FOOD_RULE_LABELS[st.food]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.scheduleActionsRow}>
                <button
                  type="button"
                  className={styles.smallActionBtn}
                  onClick={handleTogglePauseSchedule}
                  disabled={isActionLoading}
                >
                  {schedule.active ? 'Pause schedule' : 'Resume schedule'}
                </button>
                <button
                  type="button"
                  className={styles.smallActionBtn}
                  onClick={handleResyncSchedule}
                  disabled={isActionLoading}
                >
                  Resync future doses
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.scheduleCard}>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9375rem' }}>
                No regular schedule set. Doses can be logged as needed on the Today tab.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Dose History Section */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Dose History</h2>
        </div>

        {recentDoses.length === 0 ? (
          <div className={styles.scheduleCard} style={{ marginTop: '12px' }}>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9375rem' }}>
              No doses logged yet for this medicine.
            </p>
          </div>
        ) : (
          <div className={styles.historyList}>
            {recentDoses.map((dose) => (
              <div key={dose.id} className={styles.historyItem}>
                <div className={styles.historyItemLeft}>
                  <div className={styles.historyTime}>
                    {formatTimeInTz(dose.scheduled_for, profileTz)}
                  </div>
                  <div className={styles.historyDoseMeta}>
                    {dose.amount} {medicine.unit}
                    {dose.taken_at ? ` · Logged ${formatTimeInTz(dose.taken_at, profileTz)}` : ''}
                    {dose.as_needed ? ' · As needed' : ''}
                  </div>
                  {dose.stock_shortfall && dose.stock_shortfall > 0 ? (
                    <div className={styles.historyShortfall}>
                      Shortfall: {dose.stock_shortfall} {medicine.unit}
                    </div>
                  ) : null}
                </div>

                <span className={styles.historyBadge} data-status={dose.status}>
                  {dose.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Danger Zone: Delete Medicine */}
      <section className={styles.dangerZone}>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={() => {
            setModalFeedback(null);
            setIsDeleteMedOpen(true);
          }}
        >
          Remove medicine from cabinet
        </button>
      </section>

      {/* ---------------- MODALS ---------------- */}

      {/* 1. Edit Medicine Details Modal */}
      {isEditMedOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-title"
        >
          <form onSubmit={handleSaveMedEdit} className={styles.modalCard} noValidate>
            <h3 id="modal-edit-title" className={styles.modalTitle}>
              Edit medicine details
            </h3>

            <div className={styles.inputGroup}>
              <label htmlFor="edit-name-input" className={styles.label}>
                Medicine name *
              </label>
              <input
                id="edit-name-input"
                type="text"
                className={styles.input}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="edit-strength-input" className={styles.label}>
                Strength
              </label>
              <input
                id="edit-strength-input"
                type="text"
                className={styles.input}
                value={editStrength}
                onChange={(e) => setEditStrength(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="edit-unit-input" className={styles.label}>
                Unit
              </label>
              <input
                id="edit-unit-input"
                type="text"
                className={styles.input}
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="edit-purpose-input" className={styles.label}>
                Purpose
              </label>
              <input
                id="edit-purpose-input"
                type="text"
                className={styles.input}
                value={editPurpose}
                onChange={(e) => setEditPurpose(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="edit-notes-input" className={styles.label}>
                Notes
              </label>
              <textarea
                id="edit-notes-input"
                className={styles.textarea}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            {modalFeedback && (
              <div style={{ color: '#fca5a5', fontSize: '0.875rem' }}>{modalFeedback.message}</div>
            )}

            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setIsEditMedOpen(false)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button type="submit" className={styles.confirmModalBtn} disabled={isActionLoading}>
                {isActionLoading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Add Box Modal */}
      {isAddBoxOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-addbox-title"
        >
          <form onSubmit={handleSaveNewBox} className={styles.modalCard} noValidate>
            <h3 id="modal-addbox-title" className={styles.modalTitle}>
              Add a box of {medicine.name}
            </h3>

            <div className={styles.inputGroup}>
              <label htmlFor="add-box-qty" className={styles.label}>
                Quantity ({medicine.unit}) *
              </label>
              <input
                id="add-box-qty"
                type="number"
                min="1"
                step="any"
                className={styles.input}
                value={newBoxQty}
                onChange={(e) => setNewBoxQty(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="add-box-exp" className={styles.label}>
                Expiry date *
              </label>
              <input
                id="add-box-exp"
                type="text"
                placeholder="YYYY-MM or YYYY-MM-DD (e.g. 2027-08)"
                className={styles.input}
                value={newBoxExpiry}
                onChange={(e) => setNewBoxExpiry(e.target.value)}
                required
              />
            </div>

            {isNewBoxExpired && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ fontWeight: 600 }}>This date has already passed.</div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newBoxConfirmExpired}
                    onChange={(e) => setNewBoxConfirmExpired(e.target.checked)}
                  />
                  <span>Yes, this box is already expired.</span>
                </label>
              </div>
            )}

            <div className={styles.inputGroup}>
              <label htmlFor="add-box-loc" className={styles.label}>
                Storage location
              </label>
              <input
                id="add-box-loc"
                type="text"
                placeholder="e.g. Medicine Cabinet, Fridge"
                className={styles.input}
                value={newBoxLocation}
                onChange={(e) => setNewBoxLocation(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="add-box-batch" className={styles.label}>
                Batch number
              </label>
              <input
                id="add-box-batch"
                type="text"
                placeholder="e.g. B-991"
                className={styles.input}
                value={newBoxBatch}
                onChange={(e) => setNewBoxBatch(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="add-box-opened" className={styles.label}>
                Opened on date
              </label>
              <input
                id="add-box-opened"
                type="date"
                className={styles.input}
                value={newBoxOpenedOn}
                onChange={(e) => setNewBoxOpenedOn(e.target.value)}
              />
            </div>

            {modalFeedback && (
              <div style={{ color: '#fca5a5', fontSize: '0.875rem' }}>{modalFeedback.message}</div>
            )}

            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setIsAddBoxOpen(false)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button type="submit" className={styles.confirmModalBtn} disabled={isActionLoading}>
                {isActionLoading ? 'Saving…' : 'Add box'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Adjust Stock Modal */}
      {adjustingBox && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-adjust-title"
        >
          <form onSubmit={handleSaveAdjustStock} className={styles.modalCard} noValidate>
            <h3 id="modal-adjust-title" className={styles.modalTitle}>
              Adjust stock
            </h3>
            <p className={styles.modalBody}>
              Current remaining in this box: {adjustingBox.quantity_remaining} {adjustingBox.unit}.
              Enter a positive number to add stock, or a negative number to subtract (e.g. -1 for
              dropped pill).
            </p>

            <div className={styles.inputGroup}>
              <label htmlFor="adjust-delta-input" className={styles.label}>
                Quantity change (+ or -) *
              </label>
              <input
                id="adjust-delta-input"
                type="number"
                step="any"
                placeholder="e.g. -1 or 5"
                className={styles.input}
                value={adjustDelta}
                onChange={(e) =>
                  setAdjustDelta(e.target.value === '' ? '' : Number(e.target.value))
                }
                required
              />
            </div>

            {modalFeedback && (
              <div style={{ color: '#fca5a5', fontSize: '0.875rem' }}>{modalFeedback.message}</div>
            )}

            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setAdjustingBox(null)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button type="submit" className={styles.confirmModalBtn} disabled={isActionLoading}>
                {isActionLoading ? 'Saving…' : 'Save adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Discard Box Modal */}
      {discardingBox && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-discard-title"
        >
          <div className={styles.modalCard}>
            <h3 id="modal-discard-title" className={styles.modalTitle}>
              Discard this box?
            </h3>
            <p className={styles.modalBody}>
              Are you sure you want to discard this box (Expires: {discardingBox.expiry_date},{' '}
              {discardingBox.quantity_remaining} {discardingBox.unit} remaining)? Remaining stock
              will be zeroed out and recorded as discarded.
            </p>

            {modalFeedback && (
              <div style={{ color: '#fca5a5', fontSize: '0.875rem' }}>{modalFeedback.message}</div>
            )}

            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setDiscardingBox(null)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmModalBtn}
                data-danger="true"
                data-testid="confirm-discard-btn"
                onClick={handleConfirmDiscardBox}
                disabled={isActionLoading}
              >
                {isActionLoading ? 'Discarding…' : 'Discard box'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Edit Schedule Modal */}
      {isEditScheduleOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-schedule-title"
        >
          <form onSubmit={handleSaveSchedule} className={styles.modalCard} noValidate>
            <h3 id="modal-schedule-title" className={styles.modalTitle}>
              {schedule ? 'Edit schedule' : 'Set schedule'}
            </h3>

            {/* Frequency Selector */}
            <div className={styles.inputGroup}>
              <span className={styles.label}>Frequency</span>
              <div className={addStyles.freqGrid}>
                <button
                  type="button"
                  className={addStyles.freqBtn}
                  data-active={schedFrequency === 'daily'}
                  onClick={() => setSchedFrequency('daily')}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={addStyles.freqBtn}
                  data-active={schedFrequency === 'weekdays'}
                  onClick={() => setSchedFrequency('weekdays')}
                >
                  Specific days
                </button>
                <button
                  type="button"
                  className={addStyles.freqBtn}
                  data-active={schedFrequency === 'interval'}
                  onClick={() => setSchedFrequency('interval')}
                >
                  Every few days
                </button>
                <button
                  type="button"
                  className={addStyles.freqBtn}
                  data-active={schedFrequency === 'as_needed'}
                  onClick={() => setSchedFrequency('as_needed')}
                >
                  As needed
                </button>
              </div>
            </div>

            {/* Specific days pills */}
            {schedFrequency === 'weekdays' && (
              <div className={styles.inputGroup}>
                <span className={styles.label}>Choose days of the week</span>
                <div className={addStyles.weekdaysRow}>
                  {DAYS_OF_WEEK.map((d) => {
                    const isSelected = schedWeekdays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={addStyles.weekdayChip}
                        data-active={isSelected}
                        aria-label={d.fullName}
                        onClick={() => handleToggleWeekday(d.id)}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Interval Days */}
            {schedFrequency === 'interval' && (
              <div className={styles.inputGroup}>
                <label htmlFor="edit-sched-interval" className={styles.label}>
                  Take dose every N days
                </label>
                <input
                  id="edit-sched-interval"
                  type="number"
                  min="2"
                  max="365"
                  className={styles.input}
                  value={schedInterval}
                  onChange={(e) =>
                    setSchedInterval(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>
            )}

            {/* Dose Amount */}
            <div className={styles.inputGroup}>
              <label htmlFor="edit-sched-dose" className={styles.label}>
                Dose amount ({medicine.unit})
              </label>
              <input
                id="edit-sched-dose"
                type="number"
                min="0.25"
                step="any"
                className={styles.input}
                value={schedDoseAmount}
                onChange={(e) =>
                  setSchedDoseAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>

            {/* Times of Day List */}
            {schedFrequency !== 'as_needed' && (
              <div className={styles.inputGroup}>
                <span className={styles.label}>Times of day &amp; food rules</span>
                <div className={addStyles.timesList}>
                  {schedTimes.map((item, idx) => (
                    <div key={idx} className={addStyles.timeItemCard}>
                      <div className={addStyles.timeItemTop}>
                        <input
                          type="time"
                          required
                          className={addStyles.timeInput}
                          value={item.time}
                          onChange={(e) => handleTimeChange(idx, e.target.value)}
                        />
                        {schedTimes.length > 1 && (
                          <button
                            type="button"
                            className={addStyles.removeTimeBtn}
                            onClick={() => handleRemoveTime(idx)}
                            aria-label={`Remove time ${item.time}`}
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className={addStyles.foodChipsRow}>
                        {(['any', 'before_food', 'with_food', 'after_food'] as FoodRule[]).map(
                          (food) => (
                            <button
                              key={food}
                              type="button"
                              className={addStyles.foodChip}
                              data-active={item.food === food}
                              onClick={() => handleFoodChange(idx, food)}
                            >
                              {FOOD_RULE_LABELS[food]}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  ))}

                  <button type="button" className={addStyles.addTimeBtn} onClick={handleAddTime}>
                    + Add another time
                  </button>
                </div>
              </div>
            )}

            {/* Start Date */}
            <div className={styles.inputGroup}>
              <label htmlFor="edit-sched-start" className={styles.label}>
                Start date
              </label>
              <input
                id="edit-sched-start"
                type="date"
                required
                className={styles.input}
                value={schedStartDate}
                onChange={(e) => setSchedStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className={styles.inputGroup}>
              <label htmlFor="edit-sched-end" className={styles.label}>
                End date (optional)
              </label>
              <input
                id="edit-sched-end"
                type="date"
                className={styles.input}
                value={schedEndDate}
                onChange={(e) => setSchedEndDate(e.target.value)}
              />
            </div>

            {/* Instructions */}
            <div className={styles.inputGroup}>
              <label htmlFor="edit-sched-instr" className={styles.label}>
                Instructions (optional)
              </label>
              <input
                id="edit-sched-instr"
                type="text"
                maxLength={200}
                className={styles.input}
                placeholder="e.g. Take with food or milk"
                value={schedInstructions}
                onChange={(e) => setSchedInstructions(e.target.value)}
              />
            </div>

            {modalFeedback && (
              <div style={{ color: '#fca5a5', fontSize: '0.875rem' }}>{modalFeedback.message}</div>
            )}

            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setIsEditScheduleOpen(false)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button type="submit" className={styles.confirmModalBtn} disabled={isActionLoading}>
                {isActionLoading ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. Delete Medicine Modal */}
      {isDeleteMedOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-title"
        >
          <div className={styles.modalCard}>
            <h3 id="modal-delete-title" className={styles.modalTitle}>
              Remove {medicine.name}?
            </h3>
            <p className={styles.modalBody}>
              Are you sure you want to remove <strong>{medicine.name}</strong> from your cabinet?
              Its packages and schedules will be archived and hidden.
            </p>

            {modalFeedback && (
              <div style={{ color: '#fca5a5', fontSize: '0.875rem' }}>{modalFeedback.message}</div>
            )}

            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setIsDeleteMedOpen(false)}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmModalBtn}
                data-danger="true"
                data-testid="confirm-delete-medicine-btn"
                onClick={handleConfirmDeleteMed}
                disabled={isActionLoading}
              >
                {isActionLoading ? 'Removing…' : 'Remove medicine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
