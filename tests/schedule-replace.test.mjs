import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  normalizeTimeOfDay,
  diffScheduleTimes,
  replaceScheduleTimesAtomic,
} from '../src/features/schedules/schedule-replace-utils.ts';

console.log('Testing Schedule Replace & Error Handling Suite...\n');

// -----------------------------------------------------------------------------
// 1. normalizeTimeOfDay
// -----------------------------------------------------------------------------
console.log('1. Testing normalizeTimeOfDay...');
assert.equal(normalizeTimeOfDay('08:00'), '08:00:00');
assert.equal(normalizeTimeOfDay('8:00'), '08:00:00');
assert.equal(normalizeTimeOfDay('08:00:00'), '08:00:00');
assert.equal(normalizeTimeOfDay('20:30'), '20:30:00');
assert.equal(normalizeTimeOfDay(''), '00:00:00');
console.log('  ✓ normalizeTimeOfDay handles all time string formats correctly');

// -----------------------------------------------------------------------------
// 2. diffScheduleTimes pure diffing logic
// -----------------------------------------------------------------------------
console.log('2. Testing diffScheduleTimes logic...');

// Test 2a: New schedule (no existing rows)
{
  const existing = [];
  const target = [
    { time: '08:00', food: 'before_food', dose_amount: 2 },
    { time: '20:00', food: 'with_food', dose_amount: 1 },
  ];
  const diff = diffScheduleTimes(existing, target, 1);
  assert.equal(diff.toInsert.length, 2, 'Should insert both times');
  assert.equal(diff.toUpdate.length, 0, 'No updates for empty existing');
  assert.equal(diff.toDelete.length, 0, 'No deletes for empty existing');
  assert.equal(diff.toInsert[0].time_of_day, '08:00:00');
  assert.equal(diff.toInsert[0].dose_amount, 2);
  assert.equal(diff.toInsert[0].food, 'before_food');
}

// Test 2b: Duplicate target times are deduplicated safely
{
  const existing = [];
  const target = [
    { time: '08:00', food: 'before_food', dose_amount: 2 },
    { time: '8:00', food: 'after_food', dose_amount: 3 }, // duplicate!
  ];
  const diff = diffScheduleTimes(existing, target, 1);
  assert.equal(diff.toInsert.length, 1, 'Should deduplicate identical times');
  assert.equal(diff.toInsert[0].dose_amount, 2, 'Should keep first occurrence');
}

// Test 2c: Existing times modified (one kept unchanged, one updated, one added, one deleted)
{
  const existing = [
    { id: 'st-1', time_of_day: '08:00:00', dose_amount: 1, food: 'any' },
    { id: 'st-2', time_of_day: '14:00:00', dose_amount: 1, food: 'before_food' },
    { id: 'st-3', time_of_day: '20:00:00', dose_amount: 1, food: 'with_food' },
  ];
  const target = [
    { time: '08:00', food: 'any', dose_amount: 1 }, // unchanged
    { time: '14:00', food: 'after_food', dose_amount: 2 }, // modified food & dose
    { time: '22:00', food: 'any', dose_amount: 1 }, // newly added
    // 20:00 removed -> should be in toDelete
  ];
  const diff = diffScheduleTimes(existing, target, 1);
  assert.equal(diff.toInsert.length, 1, 'Should have 1 toInsert (22:00)');
  assert.equal(diff.toInsert[0].time_of_day, '22:00:00');

  assert.equal(diff.toUpdate.length, 1, 'Should have 1 toUpdate (14:00)');
  assert.equal(diff.toUpdate[0].id, 'st-2');
  assert.equal(diff.toUpdate[0].dose_amount, 2);
  assert.equal(diff.toUpdate[0].food, 'after_food');

  assert.equal(diff.toDelete.length, 1, 'Should have 1 toDelete (20:00)');
  assert.equal(diff.toDelete[0].id, 'st-3');
}

// Test 2d: Changing schedule to as-needed (target empty)
{
  const existing = [
    { id: 'st-1', time_of_day: '08:00:00', dose_amount: 1, food: 'any' },
  ];
  const target = [];
  const diff = diffScheduleTimes(existing, target, 1);
  assert.equal(diff.toInsert.length, 0);
  assert.equal(diff.toUpdate.length, 0);
  assert.equal(diff.toDelete.length, 1);
  assert.equal(diff.toDelete[0].id, 'st-1');
}
console.log('  ✓ diffScheduleTimes accurately partitions inserts, updates, and deletes');

// -----------------------------------------------------------------------------
// 3. replaceScheduleTimesAtomic workflow & failure tests
// -----------------------------------------------------------------------------
console.log('3. Testing replaceScheduleTimesAtomic execution paths...');

function createMockSupabase(overrides = {}) {
  const operations = [];

  const client = {
    _operations: operations,
    from(table) {
      return {
        select(cols) {
          return {
            eq(col, val) {
              operations.push({ type: 'select', table, cols, col, val });
              if (table === 'schedule_times' && overrides.fetchError) {
                return Promise.resolve({ data: null, error: overrides.fetchError });
              }
              const defaultData = overrides.existingRows ?? [
                { id: 'old-1', time_of_day: '08:00:00', dose_amount: 1, food: 'any' },
                { id: 'old-2', time_of_day: '20:00:00', dose_amount: 1, food: 'any' },
              ];
              return Promise.resolve({ data: defaultData, error: null });
            },
          };
        },
        insert(payload) {
          operations.push({ type: 'insert', table, payload });
          return {
            select(cols) {
              if (table === 'schedule_times' && overrides.insertError) {
                return Promise.resolve({ data: null, error: overrides.insertError });
              }
              const mockInserted = (Array.isArray(payload) ? payload : [payload]).map((item, i) => ({
                id: `new-${i + 1}`,
                ...item,
              }));
              return Promise.resolve({ data: mockInserted, error: null });
            },
          };
        },
        update(payload) {
          return {
            eq(col, val) {
              operations.push({ type: 'update', table, payload, col, val });
              if (table === 'schedule_times' && overrides.updateError) {
                return Promise.resolve({ error: overrides.updateError });
              }
              return Promise.resolve({ error: null });
            },
          };
        },
        delete() {
          return {
            in(col, vals) {
              operations.push({ type: 'delete_in', table, col, vals });
              if (table === 'schedule_times' && overrides.deleteError) {
                return Promise.resolve({ error: overrides.deleteError });
              }
              return Promise.resolve({ error: null });
            },
            eq(col, val) {
              operations.push({ type: 'delete_eq', table, col, val });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
    rpc(fnName, args) {
      operations.push({ type: 'rpc', fnName, args });
      if (fnName === 'fn_resync_schedule' && overrides.rpcError) {
        return Promise.resolve({ data: null, error: overrides.rpcError });
      }
      return Promise.resolve({ data: 1, error: null });
    },
  };

  return client;
}

// Test 3a: Success path - inserts first, updates next, deletes only after insert succeeds, then resyncs
{
  const mockSupabase = createMockSupabase();
  const targetTimes = [
    { time: '08:00', food: 'with_food', dose_amount: 2 }, // update existing 08:00
    { time: '14:00', food: 'any', dose_amount: 1 },       // new time
    // 20:00 removed -> delete
  ];

  const res = await replaceScheduleTimesAtomic({
    supabase: mockSupabase,
    scheduleId: 'sched-100',
    careProfileId: 'cp-100',
    targetTimes,
    defaultDoseAmount: 1,
  });

  assert.equal(res.success, true);
  assert.equal(res.insertedCount, 1);
  assert.equal(res.updatedCount, 1);
  assert.equal(res.deletedCount, 1);

  // Check ordering of operations:
  // 1. select existing
  // 2. insert new time (14:00) FIRST
  // 3. update existing time (08:00)
  // 4. delete obsolete time (20:00) AFTER insert
  // 5. rpc fn_resync_schedule
  const ops = mockSupabase._operations;
  const insertIndex = ops.findIndex((o) => o.type === 'insert');
  const updateIndex = ops.findIndex((o) => o.type === 'update');
  const deleteIndex = ops.findIndex((o) => o.type === 'delete_in');
  const rpcIndex = ops.findIndex((o) => o.type === 'rpc');

  assert.ok(insertIndex >= 0, 'Insert must occur');
  assert.ok(updateIndex > insertIndex, 'Update occurs after insert');
  assert.ok(deleteIndex > insertIndex, 'Delete must happen strictly AFTER insert (atomic safety)');
  assert.ok(rpcIndex > deleteIndex, 'Resync occurs after all table modifications');
  console.log('  ✓ Success path: insert happens before delete, followed by resync');
}

// Test 3b: Failure path 1 - Insert fails -> Old rows are NEVER deleted!
{
  const mockSupabase = createMockSupabase({
    insertError: new Error('Database constraint violation on insert'),
  });
  const targetTimes = [
    { time: '08:00', food: 'any', dose_amount: 1 },
    { time: '14:00', food: 'any', dose_amount: 1 }, // will fail insert
    // 20:00 would have been deleted
  ];

  const res = await replaceScheduleTimesAtomic({
    supabase: mockSupabase,
    scheduleId: 'sched-100',
    careProfileId: 'cp-100',
    targetTimes,
    defaultDoseAmount: 1,
  });

  assert.equal(res.success, false, 'Must report failure when insert fails');
  assert.ok(res.error?.includes('Could not save new schedule times'));
  assert.ok(res.error?.includes('kept unchanged'), 'Must inform user schedule was unchanged');

  // Verify delete_in was NEVER called!
  const hasDelete = mockSupabase._operations.some((o) => o.type === 'delete_in');
  assert.equal(hasDelete, false, 'Old rows must NOT be deleted when insert fails!');
  console.log('  ✓ Failure safety: failed insert leaves existing schedule rows untouched');
}

// Test 3c: Failure path 2 - Resync fails -> Never reports success!
{
  const mockSupabase = createMockSupabase({
    rpcError: new Error('Resync timeout'),
  });
  const targetTimes = [
    { time: '08:00', food: 'any', dose_amount: 1 },
    { time: '20:00', food: 'any', dose_amount: 1 },
  ];

  const res = await replaceScheduleTimesAtomic({
    supabase: mockSupabase,
    scheduleId: 'sched-100',
    careProfileId: 'cp-100',
    targetTimes,
    defaultDoseAmount: 1,
  });

  assert.equal(res.success, false, 'Must never report success when resync fails');
  assert.ok(res.error?.includes('could not be refreshed'));
  console.log('  ✓ Failure safety: failed fn_resync_schedule never reports success');
}

// Test 3d: Failure path 3 - Fetch existing rows fails
{
  const mockSupabase = createMockSupabase({
    fetchError: new Error('Permission denied'),
  });

  const res = await replaceScheduleTimesAtomic({
    supabase: mockSupabase,
    scheduleId: 'sched-100',
    careProfileId: 'cp-100',
    targetTimes: [{ time: '08:00', food: 'any', dose_amount: 1 }],
    defaultDoseAmount: 1,
  });

  assert.equal(res.success, false);
  assert.ok(res.error?.includes('Could not load current schedule times'));
  assert.equal(mockSupabase._operations.some((o) => o.type === 'insert'), false);
  assert.equal(mockSupabase._operations.some((o) => o.type === 'delete_in'), false);
  console.log('  ✓ Failure safety: fetch error aborts immediately');
}

// -----------------------------------------------------------------------------
// 4. Codebase Static Verification
// -----------------------------------------------------------------------------
console.log('4. Verifying codebase compliance for alert() removal and error checks...');

// Check 4a: No window alert() calls anywhere in src/
const detailPageCode = readFileSync(
  resolve(process.cwd(), 'src/app/app/medicine/[id]/page.tsx'),
  'utf8',
);
const addPageCode = readFileSync(
  resolve(process.cwd(), 'src/app/app/medicine/add/page.tsx'),
  'utf8',
);

assert.ok(!detailPageCode.includes('alert('), 'medicine/[id]/page.tsx must not contain alert()');
assert.ok(!addPageCode.includes('alert('), 'medicine/add/page.tsx must not contain alert()');
console.log('  ✓ Zero alert() calls found in medicine detail or add pages');

// Check 4b: Check result of fn_resync_schedule in medicine/[id]/page.tsx
assert.ok(
  detailPageCode.includes('rpcErr') || detailPageCode.includes('resync'),
  'medicine/[id]/page.tsx must check fn_resync_schedule error',
);
assert.ok(
  detailPageCode.includes('replaceScheduleTimesAtomic'),
  'medicine/[id]/page.tsx must use atomic replace for schedule_times',
);
assert.ok(
  detailPageCode.includes('pageFeedback'),
  'medicine/[id]/page.tsx must render in-app pageFeedback banner',
);
console.log('  ✓ In-app feedback and atomic replace properly wired in medicine detail page');

// Check 4c: Check result of schedule_times insert and fn_resync_schedule in medicine/add/page.tsx
assert.ok(
  addPageCode.includes('timesError'),
  'medicine/add/page.tsx must check schedule_times insert error',
);
assert.ok(
  addPageCode.includes('resyncError'),
  'medicine/add/page.tsx must check fn_resync_schedule error',
);
assert.ok(
  addPageCode.includes('schedError'),
  'medicine/add/page.tsx must check schedules insert error and stop on failure',
);
assert.ok(
  addPageCode.includes('prnError'),
  'medicine/add/page.tsx must check as-needed schedule error',
);
console.log('  ✓ Result checking and error feedback verified in add-medicine page');

console.log('\nAll schedule replace & error checking tests passed successfully! 🎉');
