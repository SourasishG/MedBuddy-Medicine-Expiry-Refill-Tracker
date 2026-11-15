import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type FoodRule = Database['public']['Enums']['food_rule'];

export interface TargetScheduleTime {
  time: string;
  food: FoodRule;
  dose_amount?: number | null;
}

export interface ExistingScheduleTime {
  id: string;
  time_of_day: string;
  dose_amount: number | null;
  food: FoodRule;
}

export interface DiffScheduleTimesResult {
  toInsert: Array<{
    time_of_day: string;
    dose_amount: number;
    food: FoodRule;
  }>;
  toUpdate: Array<{
    id: string;
    time_of_day: string;
    dose_amount: number;
    food: FoodRule;
  }>;
  toDelete: ExistingScheduleTime[];
}

export interface ReplaceScheduleTimesParams {
  supabase: SupabaseClient<Database>;
  scheduleId: string;
  careProfileId: string;
  targetTimes: TargetScheduleTime[];
  defaultDoseAmount: number;
}

export interface ReplaceScheduleTimesResult {
  success: boolean;
  error?: string;
  insertedCount: number;
  updatedCount: number;
  deletedCount: number;
}

/**
 * Normalizes any time string (e.g. "8:00", "08:00", "08:00:00") into standard HH:MM:SS format.
 */
export function normalizeTimeOfDay(timeStr: string): string {
  if (!timeStr) return '00:00:00';
  const parts = timeStr.trim().split(':');
  const h = parts[0]?.padStart(2, '0') ?? '00';
  const m = parts[1]?.padStart(2, '0') ?? '00';
  const s = parts[2]?.padStart(2, '0') ?? '00';
  return `${h}:${m}:${s}`;
}

/**
 * Pure diffing function comparing current database schedule_times against target times.
 * Handles deduplication, normalization, and categorizes into inserts, updates, and deletes.
 */
export function diffScheduleTimes(
  existingRows: ExistingScheduleTime[],
  targetTimes: TargetScheduleTime[],
  defaultDoseAmount: number,
): DiffScheduleTimesResult {
  const cleanDose =
    typeof defaultDoseAmount === 'number' && defaultDoseAmount > 0 ? defaultDoseAmount : 1;

  // Deduplicate target times by normalized time_of_day, keeping the first occurrence
  const seenTimes = new Set<string>();
  const uniqueTargetTimes: Array<{
    time_of_day: string;
    dose_amount: number;
    food: FoodRule;
  }> = [];

  for (const t of targetTimes) {
    if (!t.time) continue;
    const norm = normalizeTimeOfDay(t.time);
    if (!seenTimes.has(norm)) {
      seenTimes.add(norm);
      uniqueTargetTimes.push({
        time_of_day: norm,
        dose_amount:
          typeof t.dose_amount === 'number' && t.dose_amount > 0 ? t.dose_amount : cleanDose,
        food: t.food || 'any',
      });
    }
  }

  // Map existing rows by normalized time_of_day
  const existingMap = new Map<string, ExistingScheduleTime>();
  for (const row of existingRows) {
    existingMap.set(normalizeTimeOfDay(row.time_of_day), row);
  }

  const toInsert: DiffScheduleTimesResult['toInsert'] = [];
  const toUpdate: DiffScheduleTimesResult['toUpdate'] = [];

  for (const target of uniqueTargetTimes) {
    const existing = existingMap.get(target.time_of_day);
    if (!existing) {
      toInsert.push(target);
    } else {
      // Check if fields actually changed
      const doseChanged =
        existing.dose_amount !== null &&
        Number(existing.dose_amount) !== Number(target.dose_amount);
      const foodChanged = existing.food !== target.food;

      if (doseChanged || foodChanged || existing.dose_amount === null) {
        toUpdate.push({
          id: existing.id,
          time_of_day: target.time_of_day,
          dose_amount: target.dose_amount,
          food: target.food,
        });
      }
    }
  }

  const toDelete = existingRows.filter(
    (row) => !seenTimes.has(normalizeTimeOfDay(row.time_of_day)),
  );

  return { toInsert, toUpdate, toDelete };
}

/**
 * Atomically replaces the schedule_times for a given schedule.
 *
 * Atomicity guarantee:
 * 1. Fetches current schedule_times.
 * 2. Inserts genuinely new times FIRST. If insert fails, existing rows are NEVER deleted.
 * 3. Updates existing rows that remain. If any update fails, newly inserted rows are rolled back.
 * 4. Only once all target times are safely written are obsolete times deleted.
 * 5. Calls fn_resync_schedule to rebuild future doses and verifies the RPC result.
 * 6. Returns a clear plain-language error and never reports success if any step fails.
 */
export async function replaceScheduleTimesAtomic({
  supabase,
  scheduleId,
  careProfileId,
  targetTimes,
  defaultDoseAmount,
}: ReplaceScheduleTimesParams): Promise<ReplaceScheduleTimesResult> {
  const result: ReplaceScheduleTimesResult = {
    success: false,
    insertedCount: 0,
    updatedCount: 0,
    deletedCount: 0,
  };

  // 1. Fetch existing rows
  const { data: existingRows, error: fetchErr } = await supabase
    .from('schedule_times')
    .select('id, time_of_day, dose_amount, food')
    .eq('schedule_id', scheduleId);

  if (fetchErr || !existingRows) {
    result.error = 'Could not load current schedule times to update. Please try again.';
    return result;
  }

  // 2. Diff target times against existing rows
  const { toInsert, toUpdate, toDelete } = diffScheduleTimes(
    existingRows as ExistingScheduleTime[],
    targetTimes,
    defaultDoseAmount,
  );

  let insertedIds: string[] = [];

  // 3. Step A: Insert new times FIRST
  if (toInsert.length > 0) {
    const insertPayload = toInsert.map((t) => ({
      schedule_id: scheduleId,
      care_profile_id: careProfileId,
      time_of_day: t.time_of_day,
      dose_amount: t.dose_amount,
      food: t.food,
    }));

    const { data: insertedData, error: insErr } = await supabase
      .from('schedule_times')
      .insert(insertPayload)
      .select('id');

    if (insErr) {
      result.error =
        'Could not save new schedule times. Previous schedule times were kept unchanged.';
      return result;
    }

    insertedIds = (insertedData || []).map((d) => d.id);
    result.insertedCount = insertedIds.length;
  }

  // 4. Step B: Update existing rows that remain
  if (toUpdate.length > 0) {
    for (const item of toUpdate) {
      const { error: updErr } = await supabase
        .from('schedule_times')
        .update({
          dose_amount: item.dose_amount,
          food: item.food,
        })
        .eq('id', item.id);

      if (updErr) {
        // Rollback inserted times to leave in original state
        if (insertedIds.length > 0) {
          await supabase.from('schedule_times').delete().in('id', insertedIds);
        }
        result.error =
          'Could not update existing schedule times. Changes were rolled back to keep your schedule safe.';
        return result;
      }
      result.updatedCount += 1;
    }
  }

  // 5. Step C: Delete obsolete rows ONLY after inserts & updates succeed
  if (toDelete.length > 0) {
    const idsToDelete = toDelete.map((r) => r.id);
    const { error: delErr } = await supabase.from('schedule_times').delete().in('id', idsToDelete);

    if (delErr) {
      result.error =
        'New schedule times were added, but obsolete times could not be removed. Please review your schedule.';
      return result;
    }
    result.deletedCount = idsToDelete.length;
  }

  // 6. Step D: Resync schedule to rebuild future dose events
  const { error: rpcErr } = await supabase.rpc('fn_resync_schedule', {
    p_schedule: scheduleId,
  });

  if (rpcErr) {
    result.error =
      'Schedule times were saved, but upcoming doses could not be refreshed. Please click "Resync future doses" to regenerate them.';
    return result;
  }

  result.success = true;
  return result;
}
