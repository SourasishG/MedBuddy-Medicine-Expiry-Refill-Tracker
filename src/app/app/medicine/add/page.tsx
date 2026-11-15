'use client';

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import { parseExpiryInput, isPastExpiry } from '@/features/medicines/expiry-utils';
import {
  DAYS_OF_WEEK,
  FOOD_RULE_LABELS,
  getTodayDateString,
  type ScheduleTimeItem,
} from '@/features/schedules/schedule-utils';
import type { Database } from '@/lib/supabase/database.types';
import styles from './add-medicine.module.scss';

type MedicineForm = Database['public']['Enums']['medicine_form'];
type FoodRule = Database['public']['Enums']['food_rule'];

const FORM_OPTIONS: { id: MedicineForm; label: string; defaultUnit: string }[] = [
  { id: 'tablet', label: 'Tablet', defaultUnit: 'tablets' },
  { id: 'capsule', label: 'Capsule', defaultUnit: 'capsules' },
  { id: 'syrup', label: 'Syrup / Liquid', defaultUnit: 'ml' },
  { id: 'drops', label: 'Drops', defaultUnit: 'drops' },
  { id: 'inhaler', label: 'Inhaler', defaultUnit: 'puffs' },
  { id: 'injection', label: 'Injection', defaultUnit: 'vials' },
  { id: 'ointment', label: 'Ointment', defaultUnit: 'tubes' },
  { id: 'patch', label: 'Patch', defaultUnit: 'patches' },
  { id: 'other', label: 'Other', defaultUnit: 'units' },
];

const COMMON_LOCATIONS = [
  'Medicine Cabinet',
  'Bedside Table',
  'Kitchen Shelf',
  'Fridge',
  'Bathroom',
  'Travel Bag',
];

export default function AddMedicinePage() {
  const router = useRouter();
  const supabase = createClient();
  const { activeCareProfile, isLoading: isProfileLoading } = useCareProfile();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Medicine Info
  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState<MedicineForm>('tablet');
  const [unit, setUnit] = useState('tablets');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [shelfLifeDays, setShelfLifeDays] = useState<number | ''>('');

  // Step 2: First Box Info
  const [quantityInitial, setQuantityInitial] = useState<number | ''>(30);
  const [expiryInput, setExpiryInput] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [openedOn, setOpenedOn] = useState('');
  const [confirmExpired, setConfirmExpired] = useState(false);

  // Step 3: Schedule Info
  const [scheduleMode, setScheduleMode] = useState<'scheduled' | 'as_needed' | 'skip'>('scheduled');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'interval'>('daily');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [intervalDays, setIntervalDays] = useState<number | ''>(2);
  const [doseAmount, setDoseAmount] = useState<number | ''>(1);
  const [times, setTimes] = useState<ScheduleTimeItem[]>([{ time: '08:00', food: 'any' }]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [instructions, setInstructions] = useState('');

  // Autocomplete suggestions for medicine names
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // UI submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  const activeProfileId = activeCareProfile?.id;
  const profileTz = activeCareProfile?.timezone || 'Asia/Kolkata';

  // Fetch previous medicine names for autocomplete suggestions
  useEffect(() => {
    if (!activeProfileId) return;
    async function loadNames() {
      const { data } = await supabase
        .from('medicines')
        .select('name')
        .eq('care_profile_id', activeProfileId!)
        .is('archived_at', null);

      if (data) {
        const unique = Array.from(new Set(data.map((m) => m.name)));
        setExistingNames(unique);
      }
    }
    void loadNames();
  }, [activeProfileId, supabase]);

  // Update default unit when form changes if unit hasn't been customized
  const handleFormSelect = (selectedForm: MedicineForm) => {
    setForm(selectedForm);
    const match = FORM_OPTIONS.find((f) => f.id === selectedForm);
    if (match) {
      setUnit(match.defaultUnit);
    }
  };

  const filteredSuggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return existingNames.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q);
  }, [name, existingNames]);

  // Expiry date verification
  const parsedExpiry = useMemo(() => {
    return parseExpiryInput(expiryInput);
  }, [expiryInput]);

  const isExpired = useMemo(() => {
    if (!parsedExpiry || !/^\d{4}-\d{2}-\d{2}$/.test(parsedExpiry)) return false;
    return isPastExpiry(parsedExpiry, profileTz);
  }, [parsedExpiry, profileTz]);

  const handleStep1Submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorFeedback('Please enter a medicine name.');
      return;
    }
    setErrorFeedback(null);
    setStep(2);
  };

  const handleStep2Submit = (e: FormEvent) => {
    e.preventDefault();
    setErrorFeedback(null);

    const qty = Number(quantityInitial);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorFeedback('Please enter a valid initial quantity greater than 0.');
      return;
    }

    const finalExpiry = parseExpiryInput(expiryInput);
    if (!finalExpiry || !/^\d{4}-\d{2}-\d{2}$/.test(finalExpiry)) {
      setErrorFeedback('Please enter a valid expiry date (e.g. YYYY-MM or YYYY-MM-DD).');
      return;
    }

    if (isExpired && !confirmExpired) {
      setErrorFeedback(
        'This box has expired. Please check the date or confirm below that this box is already expired.',
      );
      return;
    }

    setErrorFeedback(null);
    setStep(3);
  };

  const handleToggleWeekday = (dayId: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort(),
    );
  };

  const handleAddTime = () => {
    setTimes((prev) => [...prev, { time: '20:00', food: 'any' }]);
  };

  const handleRemoveTime = (index: number) => {
    setTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTimeChange = (index: number, newTime: string) => {
    setTimes((prev) => prev.map((item, i) => (i === index ? { ...item, time: newTime } : item)));
  };

  const handleFoodChange = (index: number, food: FoodRule) => {
    setTimes((prev) => prev.map((item, i) => (i === index ? { ...item, food } : item)));
  };

  const handleSaveMedicine = async (skipSchedule = false) => {
    setErrorFeedback(null);

    if (!activeCareProfile) {
      setErrorFeedback('No active care profile selected.');
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorFeedback('Please enter a medicine name.');
      setStep(1);
      return;
    }

    const qty = Number(quantityInitial);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorFeedback('Please enter a valid initial quantity greater than 0.');
      setStep(2);
      return;
    }

    const finalExpiry = parseExpiryInput(expiryInput);
    if (!finalExpiry || !/^\d{4}-\d{2}-\d{2}$/.test(finalExpiry)) {
      setErrorFeedback('Please enter a valid expiry date (e.g. YYYY-MM or YYYY-MM-DD).');
      setStep(2);
      return;
    }

    if (isExpired && !confirmExpired) {
      setErrorFeedback(
        'This box has expired. Please check the date or confirm below that this box is already expired.',
      );
      setStep(2);
      return;
    }

    // Schedule validations if scheduled
    const shouldSchedule = !skipSchedule && scheduleMode === 'scheduled';
    const isPrn = !skipSchedule && scheduleMode === 'as_needed';

    if (shouldSchedule) {
      if (frequency === 'weekdays' && selectedWeekdays.length === 0) {
        setErrorFeedback('Please select at least one day of the week for this schedule.');
        return;
      }
      if (frequency === 'interval') {
        const intervalNum = Number(intervalDays);
        if (!Number.isFinite(intervalNum) || intervalNum < 2 || intervalNum > 365) {
          setErrorFeedback('Interval days must be between 2 and 365.');
          return;
        }
      }
      if (times.length === 0 || times.some((t) => !t.time)) {
        setErrorFeedback('Please specify at least one valid time of day.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorFeedback('You must be signed in to add medicine.');
        setIsSubmitting(false);
        return;
      }

      // 1. Insert into medicines
      const { data: medData, error: medError } = await supabase
        .from('medicines')
        .insert({
          care_profile_id: activeCareProfile.id,
          name: cleanName,
          strength: strength.trim() || null,
          form,
          unit: unit.trim() || 'tablets',
          purpose: purpose.trim() || null,
          notes: notes.trim() || null,
          shelf_life_after_opening_days:
            typeof shelfLifeDays === 'number' && shelfLifeDays > 0 ? shelfLifeDays : null,
        })
        .select('id')
        .single();

      if (medError || !medData) {
        setErrorFeedback('Could not save medicine details. Please check inputs and try again.');
        setIsSubmitting(false);
        return;
      }

      // 2. Insert into inventory_items (trigger auto-sets quantity_remaining and status)
      const { error: boxError } = await supabase
        .from('inventory_items')
        .insert({
          medicine_id: medData.id,
          care_profile_id: activeCareProfile.id,
          expiry_date: finalExpiry,
          quantity_initial: qty,
          batch_no: batchNo.trim() || null,
          storage_location: storageLocation.trim() || null,
          opened_on: openedOn.trim() || null,
        })
        .select('id')
        .single();

      if (boxError) {
        setErrorFeedback('Could not record the first box. Please check the date and try again.');
        setIsSubmitting(false);
        return;
      }

      // 3. Insert schedule if requested
      if (shouldSchedule) {
        const cleanDoseAmount = typeof doseAmount === 'number' && doseAmount > 0 ? doseAmount : 1;
        const cleanStartDate = startDate || getTodayDateString(profileTz);
        const cleanEndDate = endDate.trim() || null;

        const { data: schedData, error: schedError } = await supabase
          .from('schedules')
          .insert({
            care_profile_id: activeCareProfile.id,
            medicine_id: medData.id,
            frequency,
            days_of_week: frequency === 'weekdays' ? selectedWeekdays : null,
            interval_days: frequency === 'interval' ? Number(intervalDays) : null,
            start_date: cleanStartDate,
            end_date: cleanEndDate,
            dose_amount: cleanDoseAmount,
            instructions: instructions.trim() || null,
            active: true,
          })
          .select('id')
          .single();

        if (schedError || !schedData) {
          setErrorFeedback(
            'Medicine was saved, but the schedule could not be created. Please configure the schedule on the medicine page.',
          );
          setIsSubmitting(false);
          return;
        }

        // Insert schedule_times
        const timesPayload = times.map((t) => ({
          schedule_id: schedData.id,
          care_profile_id: activeCareProfile.id,
          time_of_day: t.time.length === 5 ? `${t.time}:00` : t.time,
          dose_amount: cleanDoseAmount,
          food: t.food,
        }));

        const { error: timesError } = await supabase.from('schedule_times').insert(timesPayload);
        if (timesError) {
          setErrorFeedback(
            'Medicine was saved, but schedule dose times could not be added. Please configure dose times on the medicine page.',
          );
          setIsSubmitting(false);
          return;
        }

        // Resync schedule to generate future dose events
        const { error: resyncError } = await supabase.rpc('fn_resync_schedule', {
          p_schedule: schedData.id,
        });
        if (resyncError) {
          setErrorFeedback(
            'Medicine and schedule were saved, but upcoming doses could not be generated. Please resync the schedule on the medicine page.',
          );
          setIsSubmitting(false);
          return;
        }
      } else if (isPrn) {
        // Record as-needed schedule
        const { error: prnError } = await supabase.from('schedules').insert({
          care_profile_id: activeCareProfile.id,
          medicine_id: medData.id,
          frequency: 'as_needed',
          start_date: startDate || getTodayDateString(profileTz),
          dose_amount: typeof doseAmount === 'number' && doseAmount > 0 ? doseAmount : 1,
          instructions: instructions.trim() || null,
          active: true,
        });

        if (prnError) {
          setErrorFeedback(
            'Medicine was saved, but as-needed schedule could not be created. Please configure it on the medicine page.',
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Success: redirect to medicine details
      router.push(`/app/medicine/${medData.id}`);
    } catch {
      setErrorFeedback('A network error occurred while saving. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isProfileLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.subheading}>Loading care profile…</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
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
          <span>Cancel</span>
        </Link>

        <span className={styles.stepIndicator}>Step {step} of 3</span>
      </header>

      {/* STEP 1: Medicine Details */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} className={styles.card}>
          <div>
            <h1 className={styles.heading}>Add a medicine</h1>
            <p className={styles.subheading}>
              Enter the basic medicine info. In the next steps you will record your first box and
              set optional schedules.
            </p>
          </div>

          {/* Name Field with Autocomplete */}
          <div className={styles.inputGroup}>
            <label htmlFor="med-name" className={styles.label}>
              Medicine name *
            </label>
            <input
              id="med-name"
              type="text"
              required
              autoFocus
              autoComplete="off"
              className={styles.input}
              placeholder="e.g. Paracetamol, Metformin, Eye Drops"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />

            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className={styles.autocompleteList} role="listbox">
                {filteredSuggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={styles.autocompleteItem}
                    onClick={() => {
                      setName(item);
                      setShowSuggestions(false);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
            <span className={styles.helperText}>Generic or brand name from the packaging.</span>
          </div>

          {/* Strength Field */}
          <div className={styles.inputGroup}>
            <label htmlFor="med-strength" className={styles.label}>
              Strength (optional)
            </label>
            <input
              id="med-strength"
              type="text"
              className={styles.input}
              placeholder="e.g. 500 mg, 0.5% w/v, 10 ml"
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
            />
            <span className={styles.helperText}>Leave empty if not applicable or unknown.</span>
          </div>

          {/* Form Selector */}
          <div className={styles.inputGroup}>
            <span className={styles.label}>Dosage form *</span>
            <div className={styles.formGrid} role="radiogroup" aria-label="Medicine Form">
              {FORM_OPTIONS.map((item) => {
                const isSelected = form === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-selected={isSelected}
                    className={styles.formOptionBtn}
                    onClick={() => handleFormSelect(item.id)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unit customization */}
          <div className={styles.inputGroup}>
            <label htmlFor="med-unit" className={styles.label}>
              Package unit *
            </label>
            <input
              id="med-unit"
              type="text"
              required
              className={styles.input}
              placeholder="e.g. tablets, ml, puffs"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
            <span className={styles.helperText}>
              How remaining doses or quantities are measured.
            </span>
          </div>

          {/* Purpose */}
          <div className={styles.inputGroup}>
            <label htmlFor="med-purpose" className={styles.label}>
              Purpose (optional)
            </label>
            <input
              id="med-purpose"
              type="text"
              className={styles.input}
              placeholder="e.g. Blood pressure, Headaches, Allergies"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className={styles.inputGroup}>
            <label htmlFor="med-notes" className={styles.label}>
              Notes (optional)
            </label>
            <textarea
              id="med-notes"
              className={styles.textarea}
              placeholder="Keep this short, avoid private details."
              value={notes}
              maxLength={250}
              onChange={(e) => setNotes(e.target.value)}
            />
            <span className={styles.helperText}>
              Keep this short and avoid private details (max 250 characters).
            </span>
          </div>

          {/* Shelf Life After Opening */}
          <div className={styles.inputGroup}>
            <label htmlFor="med-shelflife" className={styles.label}>
              Shelf life after opening in days (optional)
            </label>
            <input
              id="med-shelflife"
              type="number"
              min="1"
              max="365"
              className={styles.input}
              placeholder="e.g. 28 (common for eye drops and syrups)"
              value={shelfLifeDays}
              onChange={(e) =>
                setShelfLifeDays(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
            <span className={styles.helperText}>
              If specified, opened boxes will expire after this many days if earlier than printed
              date.
            </span>
          </div>

          {errorFeedback && (
            <div className={styles.feedbackBox} data-variant="error">
              {errorFeedback}
            </div>
          )}

          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryBtn}>
              <span>Next: First box details</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: First Box Details */}
      {step === 2 && (
        <form onSubmit={handleStep2Submit} className={styles.card}>
          <div>
            <h1 className={styles.heading}>First box details</h1>
            <p className={styles.subheading}>
              Add the first package in your cabinet for <strong>{name}</strong>.
            </p>
          </div>

          {/* Quantity Initial */}
          <div className={styles.inputGroup}>
            <label htmlFor="box-qty" className={styles.label}>
              Initial quantity ({unit}) *
            </label>
            <input
              id="box-qty"
              type="number"
              required
              min="1"
              step="any"
              className={styles.input}
              value={quantityInitial}
              onChange={(e) =>
                setQuantityInitial(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
            <span className={styles.helperText}>
              Total number of {unit} in this new or open container.
            </span>
          </div>

          {/* Expiry Date */}
          <div className={styles.inputGroup}>
            <label htmlFor="box-expiry" className={styles.label}>
              Expiry date *
            </label>
            <input
              id="box-expiry"
              type="text"
              required
              className={styles.input}
              placeholder="YYYY-MM or YYYY-MM-DD (e.g. 2027-08)"
              value={expiryInput}
              onChange={(e) => setExpiryInput(e.target.value)}
            />
            <span className={styles.helperText}>
              Printed date on the box or blister pack. Month &amp; year (e.g. 2027-08) is treated as
              the end of that month.
            </span>
          </div>

          {/* Past Expiry Warning & Confirmation */}
          {isExpired && (
            <div className={styles.warningBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <strong>This date has already passed.</strong>
              </div>
              <div>
                According to the date entered, this box has already expired. If this is an existing
                expired item you are tracking, please confirm below.
              </div>
              <label className={styles.confirmCheckbox}>
                <input
                  type="checkbox"
                  checked={confirmExpired}
                  onChange={(e) => setConfirmExpired(e.target.checked)}
                />
                <span>Yes, this medicine box is already expired.</span>
              </label>
            </div>
          )}

          {/* Storage Location */}
          <div className={styles.inputGroup}>
            <label htmlFor="box-location" className={styles.label}>
              Storage location (optional)
            </label>
            <input
              id="box-location"
              type="text"
              className={styles.input}
              placeholder="e.g. Medicine Cabinet, Fridge, Bedside"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
            />
            <div className={styles.quickLocations}>
              {COMMON_LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className={styles.quickLocBtn}
                  onClick={() => setStorageLocation(loc)}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Batch Number */}
          <div className={styles.inputGroup}>
            <label htmlFor="box-batch" className={styles.label}>
              Batch number (optional)
            </label>
            <input
              id="box-batch"
              type="text"
              className={styles.input}
              placeholder="e.g. B-81092"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
            />
          </div>

          {/* Opened On */}
          <div className={styles.inputGroup}>
            <label htmlFor="box-opened" className={styles.label}>
              Opened on date (optional)
            </label>
            <input
              id="box-opened"
              type="date"
              className={styles.input}
              value={openedOn}
              onChange={(e) => setOpenedOn(e.target.value)}
            />
            <span className={styles.helperText}>
              For medicines whose shelf life shortens after opening.
            </span>
          </div>

          {errorFeedback && (
            <div className={styles.feedbackBox} data-variant="error">
              {errorFeedback}
            </div>
          )}

          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setErrorFeedback(null);
                setStep(1);
              }}
              disabled={isSubmitting}
            >
              Back
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => handleSaveMedicine(true)}
              disabled={isSubmitting}
            >
              Skip schedule &amp; Save
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
              <span>Next: Set schedule</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Schedule Details */}
      {step === 3 && (
        <div className={styles.card}>
          <div>
            <h1 className={styles.heading}>Set a schedule</h1>
            <p className={styles.subheading}>
              Set up daily reminders for <strong>{name}</strong> or log doses as needed.
            </p>
          </div>

          {/* Mode Selector */}
          <div className={styles.modeCardGroup} role="radiogroup" aria-label="Schedule Type">
            <label
              className={styles.modeCard}
              data-active={scheduleMode === 'scheduled'}
              onClick={() => setScheduleMode('scheduled')}
            >
              <input
                type="radio"
                name="sched-mode"
                checked={scheduleMode === 'scheduled'}
                onChange={() => setScheduleMode('scheduled')}
              />
              <div className={styles.modeCardContent}>
                <span className={styles.modeCardTitle}>Regular schedule</span>
                <span className={styles.modeCardDesc}>
                  Daily, chosen weekdays, or every few days with calm time-of-day reminders.
                </span>
              </div>
            </label>

            <label
              className={styles.modeCard}
              data-active={scheduleMode === 'as_needed'}
              onClick={() => setScheduleMode('as_needed')}
            >
              <input
                type="radio"
                name="sched-mode"
                checked={scheduleMode === 'as_needed'}
                onChange={() => setScheduleMode('as_needed')}
              />
              <div className={styles.modeCardContent}>
                <span className={styles.modeCardTitle}>As needed (PRN)</span>
                <span className={styles.modeCardDesc}>
                  No set schedule or clock reminders. Easily logged from the Today screen when
                  taken.
                </span>
              </div>
            </label>
          </div>

          {scheduleMode === 'scheduled' && (
            <>
              {/* Frequency Selector */}
              <div className={styles.inputGroup}>
                <span className={styles.label}>Frequency</span>
                <div className={styles.freqGrid}>
                  <button
                    type="button"
                    className={styles.freqBtn}
                    data-active={frequency === 'daily'}
                    onClick={() => setFrequency('daily')}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    className={styles.freqBtn}
                    data-active={frequency === 'weekdays'}
                    onClick={() => setFrequency('weekdays')}
                  >
                    Specific days
                  </button>
                  <button
                    type="button"
                    className={styles.freqBtn}
                    data-active={frequency === 'interval'}
                    onClick={() => setFrequency('interval')}
                  >
                    Every few days
                  </button>
                </div>
              </div>

              {/* Specific days pills */}
              {frequency === 'weekdays' && (
                <div className={styles.inputGroup}>
                  <span className={styles.label}>Choose days of the week</span>
                  <div className={styles.weekdaysRow}>
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = selectedWeekdays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          className={styles.weekdayChip}
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
              {frequency === 'interval' && (
                <div className={styles.inputGroup}>
                  <label htmlFor="sched-interval" className={styles.label}>
                    Take dose every N days
                  </label>
                  <input
                    id="sched-interval"
                    type="number"
                    min="2"
                    max="365"
                    className={styles.input}
                    placeholder="e.g. 2 for alternate days, 3 for every 3 days"
                    value={intervalDays}
                    onChange={(e) =>
                      setIntervalDays(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                </div>
              )}

              {/* Dose Amount */}
              <div className={styles.inputGroup}>
                <label htmlFor="sched-dose-amt" className={styles.label}>
                  Dose amount ({unit})
                </label>
                <input
                  id="sched-dose-amt"
                  type="number"
                  min="0.25"
                  step="any"
                  className={styles.input}
                  value={doseAmount}
                  onChange={(e) =>
                    setDoseAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
                <span className={styles.helperText}>
                  Default amount to take at each scheduled time.
                </span>
              </div>

              {/* Times of Day List */}
              <div className={styles.inputGroup}>
                <span className={styles.label}>Times of day &amp; food rules</span>
                <div className={styles.timesList}>
                  {times.map((item, idx) => (
                    <div key={idx} className={styles.timeItemCard}>
                      <div className={styles.timeItemTop}>
                        <input
                          type="time"
                          required
                          className={styles.timeInput}
                          value={item.time}
                          onChange={(e) => handleTimeChange(idx, e.target.value)}
                        />
                        {times.length > 1 && (
                          <button
                            type="button"
                            className={styles.removeTimeBtn}
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

                      {/* Food rule chips */}
                      <div className={styles.foodChipsRow}>
                        {(['any', 'before_food', 'with_food', 'after_food'] as FoodRule[]).map(
                          (food) => (
                            <button
                              key={food}
                              type="button"
                              className={styles.foodChip}
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

                  <button type="button" className={styles.addTimeBtn} onClick={handleAddTime}>
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
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add another time</span>
                  </button>
                </div>
              </div>

              {/* Start Date */}
              <div className={styles.inputGroup}>
                <label htmlFor="sched-start" className={styles.label}>
                  Start date
                </label>
                <input
                  id="sched-start"
                  type="date"
                  required
                  className={styles.input}
                  value={startDate || getTodayDateString(profileTz)}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date (optional) */}
              <div className={styles.inputGroup}>
                <label htmlFor="sched-end" className={styles.label}>
                  End date (optional)
                </label>
                <input
                  id="sched-end"
                  type="date"
                  className={styles.input}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <span className={styles.helperText}>
                  Leave blank for continuous ongoing medication.
                </span>
              </div>

              {/* Instructions */}
              <div className={styles.inputGroup}>
                <label htmlFor="sched-instructions" className={styles.label}>
                  Instructions (optional)
                </label>
                <input
                  id="sched-instructions"
                  type="text"
                  maxLength={200}
                  className={styles.input}
                  placeholder="e.g. Take with a full glass of water, do not chew"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
            </>
          )}

          {scheduleMode === 'as_needed' && (
            <div className={styles.inputGroup}>
              <label htmlFor="prn-dose-amt" className={styles.label}>
                Default single dose ({unit})
              </label>
              <input
                id="prn-dose-amt"
                type="number"
                min="0.25"
                step="any"
                className={styles.input}
                value={doseAmount}
                onChange={(e) => setDoseAmount(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span className={styles.helperText}>
                Amount pre-filled when logging an as-needed dose.
              </span>
            </div>
          )}

          {errorFeedback && (
            <div className={styles.feedbackBox} data-variant="error">
              {errorFeedback}
            </div>
          )}

          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setErrorFeedback(null);
                setStep(2);
              }}
              disabled={isSubmitting}
            >
              Back
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => handleSaveMedicine(true)}
              disabled={isSubmitting}
            >
              Skip schedule
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => handleSaveMedicine(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Saving…'
              ) : (
                <>
                  <span>Save medicine</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
