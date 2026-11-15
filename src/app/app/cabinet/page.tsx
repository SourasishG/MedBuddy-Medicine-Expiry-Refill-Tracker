'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useCareProfile } from '@/features/care-profile/CareProfileContext';
import { getExpiryMeta, formatRefillHint } from '@/features/medicines/expiry-utils';
import type { Database } from '@/lib/supabase/database.types';
import styles from './cabinet.module.scss';
import todayStyles from '../today.module.scss';

type Medicine = Database['public']['Tables']['medicines']['Row'];
type InventoryStatusRow = Database['public']['Views']['inventory_status']['Row'];
type MedicineSupplyRow = Database['public']['Views']['medicine_supply']['Row'];

type CabinetFilter = 'all' | 'soon' | 'low_stock' | 'expired';

export default function CabinetPage() {
  const supabase = createClient();
  const { activeCareProfile, isLoading: isProfileLoading } = useCareProfile();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CabinetFilter>('all');

  const activeProfileId = activeCareProfile?.id;

  // Fetch medicines, inventory status, and supply views
  const { data: cabinetData, isLoading: isCabinetLoading } = useQuery({
    queryKey: ['cabinet', activeProfileId],
    queryFn: async () => {
      if (!activeProfileId) return null;

      const [medsRes, invRes, supplyRes] = await Promise.all([
        supabase
          .from('medicines')
          .select('*')
          .eq('care_profile_id', activeProfileId)
          .is('archived_at', null)
          .order('name'),
        supabase
          .from('inventory_status')
          .select('*')
          .eq('care_profile_id', activeProfileId)
          .eq('status', 'active'),
        supabase.from('medicine_supply').select('*').eq('care_profile_id', activeProfileId),
      ]);

      if (medsRes.error) {
        throw new Error(medsRes.error.message);
      }

      return {
        medicines: (medsRes.data || []) as Medicine[],
        inventory: (invRes.data || []) as InventoryStatusRow[],
        supply: (supplyRes.data || []) as MedicineSupplyRow[],
      };
    },
    enabled: Boolean(activeProfileId),
  });

  // Aggregate medicines with worst box and supply data
  const aggregatedMedicines = useMemo(() => {
    if (!cabinetData) return [];

    const { medicines, inventory, supply } = cabinetData;

    return medicines.map((med) => {
      const boxes = inventory.filter((item) => item.medicine_id === med.id);
      // Sort boxes by days_left ascending (worst box first: negative / smallest days left)
      boxes.sort((a, b) => {
        const aDays = a.days_left ?? 9999;
        const bDays = b.days_left ?? 9999;
        return aDays - bDays;
      });

      const worstBox = boxes[0] || null;
      const daysLeft = worstBox?.days_left ?? null;
      const expiryMeta = daysLeft !== null ? getExpiryMeta(daysLeft) : null;

      const sup = supply.find((s) => s.medicine_id === med.id);
      const remaining =
        sup?.remaining ?? boxes.reduce((acc, b) => acc + (b.quantity_remaining || 0), 0);
      const refillHint = formatRefillHint({
        remaining,
        dailyUsage: sup?.daily_usage,
        daysOfSupply: sup?.days_of_supply,
        unit: med.unit,
      });

      return {
        ...med,
        boxes,
        worstBox,
        daysLeft,
        expiryMeta,
        remaining,
        daysOfSupply: sup?.days_of_supply,
        refillHint,
      };
    });
  }, [cabinetData]);

  // Counts for filter chips
  const counts = useMemo(() => {
    let soon = 0;
    let lowStock = 0;
    let expired = 0;

    for (const m of aggregatedMedicines) {
      if (m.daysLeft !== null) {
        if (m.daysLeft < 0) expired++;
        else if (m.daysLeft <= 30) soon++;
      }
      if (
        (m.daysOfSupply !== null && m.daysOfSupply !== undefined && m.daysOfSupply <= 7) ||
        m.remaining <= 5
      ) {
        lowStock++;
      }
    }

    return { all: aggregatedMedicines.length, soon, lowStock, expired };
  }, [aggregatedMedicines]);

  // Filtered & searched medicines
  const filteredMedicines = useMemo(() => {
    return aggregatedMedicines.filter((m) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesStrength = m.strength?.toLowerCase().includes(q);
        const matchesPurpose = m.purpose?.toLowerCase().includes(q);
        const matchesLocation = m.boxes.some((b) => b.storage_location?.toLowerCase().includes(q));

        if (!matchesName && !matchesStrength && !matchesPurpose && !matchesLocation) {
          return false;
        }
      }

      // 2. Filter Chip
      if (activeFilter === 'soon') {
        return m.daysLeft !== null && m.daysLeft >= 0 && m.daysLeft <= 30;
      }
      if (activeFilter === 'low_stock') {
        return (
          (m.daysOfSupply !== null && m.daysOfSupply !== undefined && m.daysOfSupply <= 7) ||
          m.remaining <= 5
        );
      }
      if (activeFilter === 'expired') {
        return m.daysLeft !== null && m.daysLeft < 0;
      }

      return true;
    });
  }, [aggregatedMedicines, searchQuery, activeFilter]);

  if (isProfileLoading || isCabinetLoading) {
    return (
      <div
        className={todayStyles.skeletonContainer}
        aria-busy="true"
        aria-label="Loading cabinet medicines"
      >
        <div className={todayStyles.skeletonCard}>
          <div className={todayStyles.shimmer} />
        </div>
        <div className={todayStyles.skeletonCard}>
          <div className={todayStyles.shimmer} />
        </div>
        <div className={todayStyles.skeletonCard}>
          <div className={todayStyles.shimmer} />
        </div>
      </div>
    );
  }

  // Profile has zero medicines added
  if (aggregatedMedicines.length === 0) {
    return (
      <div className={styles.cabinetContainer}>
        <div className={styles.emptyState}>
          <h1 className={styles.emptyTitle}>Cabinet for {activeCareProfile?.name || 'you'}</h1>
          <p className={styles.emptyText}>
            No medicines stored yet. Keep track of expiry dates, batches, and remaining stock.
          </p>
          <Link href="/app/medicine/add" className={styles.emptyAction}>
            <span>Add a medicine</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cabinetContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>Cabinet</h1>
        <Link href="/app/medicine/add" className={styles.addBtnHeader}>
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add</span>
        </Link>
      </header>

      {/* Search Bar */}
      <div className={styles.searchBar}>
        <svg
          className={styles.searchIcon}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search by name, strength, place…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search medicines in cabinet"
        />

        {searchQuery && (
          <button
            type="button"
            className={styles.clearSearchBtn}
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
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
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className={styles.filtersScroll} role="tablist" aria-label="Filter cabinet medicines">
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'all'}
          data-active={activeFilter === 'all'}
          className={styles.filterChip}
          onClick={() => setActiveFilter('all')}
        >
          All <span className={styles.countBadge}>{counts.all}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'soon'}
          data-active={activeFilter === 'soon'}
          className={styles.filterChip}
          onClick={() => setActiveFilter('soon')}
        >
          Expiring soon <span className={styles.countBadge}>{counts.soon}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'low_stock'}
          data-active={activeFilter === 'low_stock'}
          className={styles.filterChip}
          onClick={() => setActiveFilter('low_stock')}
        >
          Low stock <span className={styles.countBadge}>{counts.lowStock}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'expired'}
          data-active={activeFilter === 'expired'}
          className={styles.filterChip}
          onClick={() => setActiveFilter('expired')}
        >
          Expired <span className={styles.countBadge}>{counts.expired}</span>
        </button>
      </div>

      {/* Medicines List */}
      {filteredMedicines.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No matching medicines</div>
          <p className={styles.emptyText}>
            {searchQuery
              ? `No medicines match "${searchQuery}". Try a different keyword.`
              : 'No medicines in this category.'}
          </p>
        </div>
      ) : (
        <div className={styles.medicineList}>
          {filteredMedicines.map((med) => {
            const { expiryMeta, remaining, refillHint, worstBox } = med;
            const isCriticalSupply =
              med.daysOfSupply !== null && med.daysOfSupply !== undefined && med.daysOfSupply <= 3;
            const isUrgentSupply =
              med.daysOfSupply !== null && med.daysOfSupply !== undefined && med.daysOfSupply <= 7;

            return (
              <Link
                key={med.id}
                href={`/app/medicine/${med.id}`}
                className={styles.medicineCard}
                aria-label={`${med.name} ${med.strength || ''}, ${remaining} ${med.unit} remaining, ${expiryMeta?.label || 'No box'} ${expiryMeta?.humanText || ''}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.medNameRow}>
                    <div className={styles.medName}>{med.name}</div>
                    <div className={styles.medStrength}>
                      {med.strength ? `${med.strength} · ` : ''}
                      {med.form}
                      {worstBox?.storage_location ? ` · ${worstBox.storage_location}` : ''}
                    </div>
                  </div>

                  {expiryMeta ? (
                    <span className={styles.badge} data-band={expiryMeta.band}>
                      {expiryMeta.band === 'fresh' && (
                        <svg
                          className={styles.badgeIcon}
                          width="12"
                          height="12"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2.5 7.2L5.6 10.2L11.5 4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      {expiryMeta.band === 'soon' && (
                        <svg
                          className={styles.badgeIcon}
                          width="12"
                          height="12"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                          <path
                            d="M7 4.2v3.2l2 1.2"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                      {(expiryMeta.band === 'urgent' || expiryMeta.band === 'expired') && (
                        <svg
                          className={styles.badgeIcon}
                          width="12"
                          height="12"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M7 2.2L1.8 11.5h10.4L7 2.2zM7 5.8v2.4M7 10v.4"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      <span>
                        {expiryMeta.label} · {expiryMeta.humanText}
                      </span>
                    </span>
                  ) : (
                    <span className={styles.badge} data-band="none">
                      No active boxes
                    </span>
                  )}
                </div>

                <div className={styles.cardMetaRow}>
                  <div className={styles.stockInfo}>
                    <span>
                      {remaining} {med.unit}
                    </span>
                    {med.boxes.length > 1 && (
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                        ({med.boxes.length} boxes)
                      </span>
                    )}
                  </div>

                  <div
                    className={styles.refillHint}
                    data-urgent={isUrgentSupply}
                    data-critical={isCriticalSupply}
                  >
                    {refillHint}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
