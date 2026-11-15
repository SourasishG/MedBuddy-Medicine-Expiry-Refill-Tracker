'use client';

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import { parseExpiryInput, isPastExpiry } from '@/features/medicines/expiry-utils';
import type { Database } from '@/lib/supabase/database.types';
import styles from './add-medicine.module.scss';

type MedicineForm = Database['public']['Enums']['medicine_form'];

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

  const [step, setStep] = useState<1 | 2>(1);

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

  // Autocomplete suggestions for medicine names
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // UI submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  const activeProfileId = activeCareProfile?.id;
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
    return isPastExpiry(parsedExpiry, activeCareProfile?.timezone || 'Asia/Kolkata');
  }, [parsedExpiry, activeCareProfile?.timezone]);

  const handleStep1Submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorFeedback('Please enter a medicine name.');
      return;
    }
    setErrorFeedback(null);
    setStep(2);
  };

  const handleSaveMedicine = async (e: FormEvent) => {
    e.preventDefault();
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

      // 2. Insert into inventory_items
      const { error: boxError } = await supabase
        .from('inventory_items')
        .insert({
          medicine_id: medData.id,
          care_profile_id: activeCareProfile.id,
          expiry_date: finalExpiry,
          quantity_initial: qty,
          quantity_remaining: qty,
          batch_no: batchNo.trim() || null,
          storage_location: storageLocation.trim() || null,
          opened_on: openedOn.trim() || null,
          status: 'active',
        })
        .select('id')
        .single();

      if (boxError) {
        setErrorFeedback(
          'Medicine created, but could not record the first box. Please add a box from medicine details.',
        );
        setIsSubmitting(false);
        router.push(`/app/medicine/${medData.id}`);
        return;
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

        <span className={styles.stepIndicator}>Step {step} of 2</span>
      </header>

      {step === 1 ? (
        <>
          <h1 className={styles.heading}>Add a medicine</h1>
          <p className={styles.subheading}>
            Adding to <strong>{activeCareProfile?.name}</strong>’s cabinet.
          </p>

          <form onSubmit={handleStep1Submit} className={styles.card} noValidate>
            {/* Medicine Name */}
            <div className={styles.inputGroup}>
              <label htmlFor="med-name" className={styles.label}>
                Medicine name *
              </label>
              <input
                id="med-name"
                type="text"
                className={styles.input}
                placeholder="e.g. Paracetamol, Metformin"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                required
                autoComplete="off"
              />

              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className={styles.suggestionsList}>
                  {filteredSuggestions.map((item) => (
                    <li
                      key={item}
                      className={styles.suggestionItem}
                      onClick={() => {
                        setName(item);
                        setShowSuggestions(false);
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Strength */}
            <div className={styles.inputGroup}>
              <label htmlFor="med-strength" className={styles.label}>
                Strength (optional)
              </label>
              <input
                id="med-strength"
                type="text"
                className={styles.input}
                placeholder="e.g. 500 mg, 1000 IU, 10 ml"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
              />
            </div>

            {/* Form Selection */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Form</label>
              <div className={styles.pillsRow} role="radiogroup" aria-label="Medicine Form">
                {FORM_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={form === f.id}
                    data-selected={form === f.id}
                    className={styles.pillBtn}
                    onClick={() => handleFormSelect(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Purpose */}
            <div className={styles.inputGroup}>
              <label htmlFor="med-purpose" className={styles.label}>
                What is this for? (optional)
              </label>
              <span className={styles.helperText}>Keep this short, avoid private details.</span>
              <input
                id="med-purpose"
                type="text"
                className={styles.input}
                placeholder="e.g. Blood pressure, Daily vitamin"
                value={purpose}
                maxLength={200}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className={styles.inputGroup}>
              <label htmlFor="med-notes" className={styles.label}>
                Notes (optional)
              </label>
              <span className={styles.helperText}>Keep this short, avoid private details.</span>
              <textarea
                id="med-notes"
                className={styles.textarea}
                placeholder="e.g. Take with water after food"
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Optional Shelf life after opening */}
            {(form === 'syrup' || form === 'drops' || form === 'ointment') && (
              <div className={styles.inputGroup}>
                <label htmlFor="med-shelflife" className={styles.label}>
                  Shelf life after opening (days)
                </label>
                <span className={styles.helperText}>
                  e.g. 28 days for opened eye drops or liquid syrups.
                </span>
                <input
                  id="med-shelflife"
                  type="number"
                  min={1}
                  max={365}
                  className={styles.input}
                  placeholder="e.g. 28"
                  value={shelfLifeDays}
                  onChange={(e) =>
                    setShelfLifeDays(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>
            )}

            {errorFeedback && (
              <div className={styles.feedbackBox} data-variant="error">
                {errorFeedback}
              </div>
            )}

            <div className={styles.buttonRow}>
              <button type="submit" className={styles.primaryBtn}>
                <span>Next: First box details</span>
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
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <h1 className={styles.heading}>First box details</h1>
          <p className={styles.subheading}>
            Add the initial quantity, unit, and expiry date for{' '}
            <strong>{name || 'this medicine'}</strong>.
          </p>

          <form onSubmit={handleSaveMedicine} className={styles.card} noValidate>
            {/* Quantity and Unit */}
            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label htmlFor="box-qty" className={styles.label}>
                  Quantity *
                </label>
                <input
                  id="box-qty"
                  type="number"
                  min={1}
                  step={1}
                  className={styles.input}
                  value={quantityInitial}
                  onChange={(e) =>
                    setQuantityInitial(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="box-unit" className={styles.label}>
                  Unit *
                </label>
                <input
                  id="box-unit"
                  type="text"
                  className={styles.input}
                  placeholder="tablets"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Expiry Date */}
            <div className={styles.inputGroup}>
              <label htmlFor="box-expiry" className={styles.label}>
                Expiry date *
              </label>
              <span className={styles.helperText}>
                Enter Month &amp; Year (e.g. 2027-05) or exact date.
              </span>
              <input
                id="box-expiry"
                type="text"
                className={styles.input}
                placeholder="YYYY-MM (e.g. 2027-05)"
                value={expiryInput}
                onChange={(e) => {
                  setExpiryInput(e.target.value);
                  setConfirmExpired(false);
                }}
                required
              />
            </div>

            {/* Expired warning and confirmation */}
            {isExpired && (
              <div className={styles.warningBox}>
                <div>
                  <strong>Notice:</strong> This box has already expired ({parsedExpiry}). Check the
                  date or confirm below if you intend to record an expired package.
                </div>
                <label className={styles.confirmCheckbox}>
                  <input
                    type="checkbox"
                    checked={confirmExpired}
                    onChange={(e) => setConfirmExpired(e.target.checked)}
                  />
                  <span>This is already expired</span>
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
                placeholder="e.g. Medicine Cabinet, Bedside"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
              />
              <div className={styles.pillsRow} style={{ marginTop: '4px' }}>
                {COMMON_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    className={styles.pillBtn}
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
                Batch / Lot number (optional)
              </label>
              <input
                id="box-batch"
                type="text"
                className={styles.input}
                placeholder="e.g. B2409"
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
              />
            </div>

            {/* Opened on Date */}
            <div className={styles.inputGroup}>
              <label htmlFor="box-opened" className={styles.label}>
                Opened on (optional)
              </label>
              <input
                id="box-opened"
                type="date"
                className={styles.input}
                value={openedOn}
                onChange={(e) => setOpenedOn(e.target.value)}
              />
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
              <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save medicine'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
