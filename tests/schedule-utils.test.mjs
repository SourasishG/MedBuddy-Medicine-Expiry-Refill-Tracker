import assert from 'node:assert/strict';
import {
  getTodayDateString,
  getLocalDateString,
  formatTimeInTz,
  formatHeaderDate,
  formatClockTime,
  categorizeDoseEvents,
  formatScheduleSummary,
} from '../src/features/schedules/schedule-utils.ts';

console.log('Testing Schedule & Timezone Utility Functions...\n');

// 1. Timezone-specific "Today" formatting
console.log('1. Verifying getTodayDateString across timezones...');
const testDate = new Date('2026-11-15T20:30:00Z'); // 8:30 PM UTC
// In Asia/Kolkata (UTC+5:30), this is 2026-11-16 at 02:00 AM!
const kolkataDate = getTodayDateString('Asia/Kolkata', testDate);
assert.equal(kolkataDate, '2026-11-16', 'Should roll over to next day in Asia/Kolkata');

// In America/New_York (UTC-5), this is 2026-11-15 at 15:30!
const nyDate = getTodayDateString('America/New_York', testDate);
assert.equal(nyDate, '2026-11-15', 'Should stay on 2026-11-15 in America/New_York');

// Verify getLocalDateString
assert.equal(getLocalDateString('2026-11-15T22:00:00Z', 'Asia/Kolkata'), '2026-11-16');
assert.equal(getLocalDateString('2026-11-15T22:00:00Z', 'UTC'), '2026-11-15');

// Verify formatHeaderDate
const headerDate = formatHeaderDate('UTC', new Date('2026-11-15T12:00:00Z'));
assert.ok(headerDate.includes('Sunday') && headerDate.includes('15') && headerDate.includes('November'));
console.log('  ✓ Timezone date rollover and header formatting validated correctly');

// 2. formatTimeInTz
console.log('2. Verifying formatTimeInTz...');
const timeIso = '2026-11-15T08:00:00Z';
const formattedKolkataTime = formatTimeInTz(timeIso, 'Asia/Kolkata'); // 1:30 PM
assert.ok(formattedKolkataTime.includes('1:30') && formattedKolkataTime.includes('PM'));

const formattedUtcTime = formatTimeInTz(timeIso, 'UTC'); // 8:00 AM
assert.ok(formattedUtcTime.includes('8:00') && formattedUtcTime.includes('AM'));
console.log('  ✓ formatTimeInTz handles timezones properly');

// 3. formatClockTime
console.log('3. Verifying formatClockTime 24h -> 12h conversion...');
assert.equal(formatClockTime('08:00'), '8:00 AM');
assert.equal(formatClockTime('13:45'), '1:45 PM');
assert.equal(formatClockTime('00:15'), '12:15 AM');
assert.equal(formatClockTime('12:00'), '12:00 PM');
console.log('  ✓ Clock time formatting validated');

// 4. Dose Categorization (Due Now, Later Today, Missed, Done Today)
console.log('4. Verifying categorizeDoseEvents clinical partitioning...');
const now = new Date('2026-11-15T10:00:00Z');
const mockEvents = [
  // 1. Due Now: scheduled 30 mins ago, pending, not snoozed
  {
    id: 'ev-due-1',
    care_profile_id: 'cp-1',
    medicine_id: 'm-1',
    scheduled_for: '2026-11-15T09:30:00Z',
    amount: 1,
    status: 'pending',
    snoozed_until: null,
  },
  // 2. Later Today: scheduled in 2 hours
  {
    id: 'ev-later-1',
    care_profile_id: 'cp-1',
    medicine_id: 'm-2',
    scheduled_for: '2026-11-15T12:00:00Z',
    amount: 2,
    status: 'pending',
    snoozed_until: null,
  },
  // 3. Later Today (Snoozed): scheduled 45 mins ago, but snoozed until 11:00 AM
  {
    id: 'ev-snoozed-1',
    care_profile_id: 'cp-1',
    medicine_id: 'm-3',
    scheduled_for: '2026-11-15T09:15:00Z',
    amount: 1,
    status: 'pending',
    snoozed_until: '2026-11-15T11:00:00Z',
  },
  // 4. Missed: scheduled 3 hours ago (180 mins > 120 mins threshold)
  {
    id: 'ev-missed-1',
    care_profile_id: 'cp-1',
    medicine_id: 'm-4',
    scheduled_for: '2026-11-15T07:00:00Z',
    amount: 1,
    status: 'pending',
    snoozed_until: null,
  },
  // 5. Done Today (Taken): scheduled earlier, taken at 08:30 AM
  {
    id: 'ev-taken-1',
    care_profile_id: 'cp-1',
    medicine_id: 'm-5',
    scheduled_for: '2026-11-15T08:00:00Z',
    amount: 1,
    status: 'taken',
    taken_at: '2026-11-15T08:30:00Z',
  },
  // 6. Done Today (Skipped)
  {
    id: 'ev-skipped-1',
    care_profile_id: 'cp-1',
    medicine_id: 'm-6',
    scheduled_for: '2026-11-15T08:00:00Z',
    amount: 1,
    status: 'skipped',
    taken_at: null,
  },
];

const categorized = categorizeDoseEvents(mockEvents, 'UTC', 120, now);
assert.equal(categorized.dueNow.length, 1, 'Should have 1 due now dose');
assert.equal(categorized.dueNow[0].id, 'ev-due-1');

assert.equal(categorized.laterToday.length, 2, 'Should have 2 later today doses (1 future + 1 snoozed)');
assert.ok(categorized.laterToday.some(e => e.id === 'ev-later-1'));
assert.ok(categorized.laterToday.some(e => e.id === 'ev-snoozed-1'));

assert.equal(categorized.missed.length, 1, 'Should have 1 missed dose exceeding threshold');
assert.equal(categorized.missed[0].id, 'ev-missed-1');

assert.equal(categorized.doneToday.length, 2, 'Should have 2 done doses (taken + skipped)');
assert.ok(categorized.doneToday.some(e => e.id === 'ev-taken-1'));
assert.ok(categorized.doneToday.some(e => e.id === 'ev-skipped-1'));
console.log('  ✓ categorizeDoseEvents correctly partitions all 4 sections');

// 5. formatScheduleSummary
console.log('5. Verifying formatScheduleSummary...');
assert.equal(
  formatScheduleSummary('daily', [{ time_of_day: '08:00:00' }, { time_of_day: '20:00:00' }]),
  'Daily at 8:00 AM, 8:00 PM'
);
assert.equal(
  formatScheduleSummary('weekdays', [{ time_of_day: '09:00:00' }], [1, 3, 5]),
  'On Mon, Wed, Fri at 9:00 AM'
);
assert.equal(
  formatScheduleSummary('interval', [{ time_of_day: '10:00:00' }], null, 3),
  'Every 3 days at 10:00 AM'
);
assert.equal(
  formatScheduleSummary('as_needed'),
  'Taken as needed (no fixed schedule)'
);
console.log('  ✓ formatScheduleSummary generates clean human-readable summaries');

console.log('\n=================================================================');
console.log('✅ ALL SCHEDULE & TIMEZONE UTILITY TESTS PASSED!');
console.log('=================================================================\n');
