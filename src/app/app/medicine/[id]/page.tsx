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
import type { Database } from '@/lib/supabase/database.types';
import styles from './medicine-detail.module.scss';
import todayStyles from '../../today.module.scss';

type Medicine = Database['public']['Tables']['medicines']['Row'];
type InventoryStatusRow = Database['public']['Views']['inventory_status']['Row'];
type MedicineSupplyRow = Database['public']['Views']['medicine_supply']['Row'];
type MedicineForm = Database['public']['Enums']['medicine_form'];

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

  // Async action feedback
  const [modalFeedback, setModalFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Fetch medicine, boxes, and supply
  const { data, isLoading: isDataLoading } = useQuery({
    queryKey: ['medicine-detail', medicineId],
    queryFn: async () => {
      const [medRes, boxesRes, supplyRes] = await Promise.all([
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
      };
    },
    enabled: Boolean(medicineId),
  });

  const medicine = data?.medicine;
  const boxes = useMemo(() => data?.boxes || [], [data?.boxes]);
  const supply = data?.supply;

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

  const handleSaveAddBox = async (e: React.FormEvent) => {
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

    const isBoxExpired = isPastExpiry(finalExpiry, activeCareProfile.timezone);
    if (isBoxExpired && !newBoxConfirmExpired) {
      setModalFeedback({
        type: 'error',
        message: 'This box has expired. Check the date or confirm below if you intend to add it.',
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
        quantity_remaining: qty,
        expiry_date: finalExpiry,
        batch_no: newBoxBatch.trim() || null,
        storage_location: newBoxLocation.trim() || null,
        opened_on: newBoxOpenedOn.trim() || null,
        status: 'active',
      });

      if (error) {
        setModalFeedback({ type: 'error', message: 'Could not add box. Please try again.' });
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

  // Adjust Stock Action
  const handleOpenAdjustStock = (box: InventoryStatusRow) => {
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
        message: 'Please enter a non-zero adjustment amount (+ to add, - to subtract).',
      });
      return;
    }

    if (adjustingBox.quantity_remaining + delta < 0) {
      setModalFeedback({
        type: 'error',
        message: `Cannot subtract ${Math.abs(delta)}: this box only has ${adjustingBox.quantity_remaining} left.`,
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
        setModalFeedback({ type: 'error', message: 'Could not adjust stock. Please try again.' });
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

  // Discard Box Action
  const handleOpenDiscardBox = (box: InventoryStatusRow) => {
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
        setModalFeedback({ type: 'error', message: 'Could not discard box. Please try again.' });
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

  // Delete / Archive Medicine Action
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
              <div key={box.id} className={styles.boxCard}>
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
                    onClick={() => handleOpenAdjustStock(box)}
                  >
                    Adjust stock
                  </button>
                  <button
                    type="button"
                    className={styles.smallActionBtn}
                    data-danger="true"
                    onClick={() => handleOpenDiscardBox(box)}
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
              <input
                id="edit-notes-input"
                type="text"
                className={styles.input}
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
          aria-labelledby="modal-box-title"
        >
          <form onSubmit={handleSaveAddBox} className={styles.modalCard} noValidate>
            <h3 id="modal-box-title" className={styles.modalTitle}>
              Add a box of {medicine.name}
            </h3>

            <div className={styles.inputGroup}>
              <label htmlFor="add-box-qty" className={styles.label}>
                Quantity ({medicine.unit}) *
              </label>
              <input
                id="add-box-qty"
                type="number"
                min={1}
                className={styles.input}
                value={newBoxQty}
                onChange={(e) => setNewBoxQty(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="add-box-exp" className={styles.label}>
                Expiry date (YYYY-MM or YYYY-MM-DD) *
              </label>
              <input
                id="add-box-exp"
                type="text"
                placeholder="e.g. 2027-05"
                className={styles.input}
                value={newBoxExpiry}
                onChange={(e) => {
                  setNewBoxExpiry(e.target.value);
                  setNewBoxConfirmExpired(false);
                }}
                required
              />
            </div>

            {newBoxExpiry &&
              isPastExpiry(parseExpiryInput(newBoxExpiry), activeCareProfile?.timezone) && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    padding: '10px',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ color: '#fca5a5', fontSize: '0.8125rem' }}>
                    Notice: This date has already passed.
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#fff',
                      fontSize: '0.8125rem',
                      marginTop: '6px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newBoxConfirmExpired}
                      onChange={(e) => setNewBoxConfirmExpired(e.target.checked)}
                    />
                    <span>This box is already expired</span>
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
                Batch / Lot number
              </label>
              <input
                id="add-box-batch"
                type="text"
                placeholder="e.g. B2409"
                className={styles.input}
                value={newBoxBatch}
                onChange={(e) => setNewBoxBatch(e.target.value)}
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
                {isActionLoading ? 'Adding…' : 'Add box'}
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
              Current remaining in this box:{' '}
              <strong>
                {adjustingBox.quantity_remaining} {adjustingBox.unit}
              </strong>
              . Enter positive number to add stock, or negative number to subtract (e.g. dropped
              pill).
            </p>

            <div className={styles.inputGroup}>
              <label htmlFor="adjust-delta-input" className={styles.label}>
                Adjustment amount (+ / -) *
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
                onClick={handleConfirmDiscardBox}
                disabled={isActionLoading}
              >
                {isActionLoading ? 'Discarding…' : 'Discard box'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete Medicine Modal */}
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
