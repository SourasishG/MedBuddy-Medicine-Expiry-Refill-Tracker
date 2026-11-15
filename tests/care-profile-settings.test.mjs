import assert from 'node:assert/strict';
import {
  validateProfileSettings,
  getUpdateErrorMessage,
  DEFAULT_FALLBACK_SNOOZE_MINUTES,
  DEFAULT_RENUDGE_MINUTES,
  DEFAULT_MISSED_MINUTES,
  PERMISSION_DENIED_MESSAGE,
  GENERIC_UPDATE_ERROR_MESSAGE,
} from '../src/features/care-profile/profile-settings-validation.ts';

console.log('Testing Care Profile Settings validation and error handling...\n');

// 1. Fallback Snooze Constant
console.log('1. Verifying fallback snooze constant...');
assert.equal(
  DEFAULT_FALLBACK_SNOOZE_MINUTES,
  10,
  'Fallback snooze must be exactly 10 minutes (not 15)',
);
assert.equal(DEFAULT_RENUDGE_MINUTES, 30);
assert.equal(DEFAULT_MISSED_MINUTES, 120);
console.log('  ✓ Fallback snooze is 10 minutes');

// 2. Profile Name Validation
console.log('2. Verifying name validation...');
const emptyNameRes = validateProfileSettings({
  name: '   ',
  snoozeMinutes: 10,
  missedMinutes: 120,
  renudgeMinutes: 30,
});
assert.equal(emptyNameRes.isValid, false);
assert.equal(emptyNameRes.error, 'Please enter a name for this care profile.');

const validNameRes = validateProfileSettings({
  name: '  Papa  ',
  snoozeMinutes: 10,
  missedMinutes: 120,
  renudgeMinutes: 30,
});
assert.equal(validNameRes.isValid, true);
assert.equal(validNameRes.cleanName, 'Papa');
console.log('  ✓ Name trimming and empty checks work correctly');

// 3. Snooze Range Validation (5 - 120)
console.log('3. Verifying snooze range validation (5–120 mins)...');
// Under min (4)
const snoozeLow = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 4,
  missedMinutes: 120,
  renudgeMinutes: 30,
});
assert.equal(snoozeLow.isValid, false);
assert.equal(snoozeLow.error, 'Snooze duration must be between 5 and 120 minutes.');

// Over max (121)
const snoozeHigh = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 121,
  missedMinutes: 120,
  renudgeMinutes: 30,
});
assert.equal(snoozeHigh.isValid, false);
assert.equal(snoozeHigh.error, 'Snooze duration must be between 5 and 120 minutes.');

// Non-integer / invalid
const snoozeFloat = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 10.5,
  missedMinutes: 120,
  renudgeMinutes: 30,
});
assert.equal(snoozeFloat.isValid, false);
assert.equal(snoozeFloat.error, 'Snooze duration must be between 5 and 120 minutes.');

const snoozeEmpty = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: '',
  missedMinutes: 120,
  renudgeMinutes: 30,
});
assert.equal(snoozeEmpty.isValid, false);
assert.equal(snoozeEmpty.error, 'Snooze duration must be between 5 and 120 minutes.');

// Valid boundaries: 5 and 120
const snoozeMinBound = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 5,
  missedMinutes: 120,
  renudgeMinutes: 30,
});
assert.equal(snoozeMinBound.isValid, true);
assert.equal(snoozeMinBound.snoozeMinutes, 5);

const snoozeMaxBound = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 120,
  missedMinutes: 120,
  renudgeMinutes: 30,
});
assert.equal(snoozeMaxBound.isValid, true);
assert.equal(snoozeMaxBound.snoozeMinutes, 120);
console.log('  ✓ Snooze 5–120 range and boundary checks passed');

// 4. Missed-After Range Validation (30 - 720)
console.log('4. Verifying missed-after range validation (30–720 mins)...');
// Under min (29)
const missedLow = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 10,
  missedMinutes: 29,
  renudgeMinutes: 20,
});
assert.equal(missedLow.isValid, false);
assert.equal(missedLow.error, 'Missed dose cutoff must be between 30 and 720 minutes.');

// Over max (721)
const missedHigh = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 10,
  missedMinutes: 721,
  renudgeMinutes: 30,
});
assert.equal(missedHigh.isValid, false);
assert.equal(missedHigh.error, 'Missed dose cutoff must be between 30 and 720 minutes.');

// Non-integer
const missedFloat = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 10,
  missedMinutes: 60.5,
  renudgeMinutes: 30,
});
assert.equal(missedFloat.isValid, false);
assert.equal(missedFloat.error, 'Missed dose cutoff must be between 30 and 720 minutes.');

// Valid max boundary (720)
const missedMaxBound = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 10,
  missedMinutes: 720,
  renudgeMinutes: 30,
});
assert.equal(missedMaxBound.isValid, true);
assert.equal(missedMaxBound.missedMinutes, 720);
console.log('  ✓ Missed-after 30–720 range checks passed');

// 5. Missed Must Be Greater Than Re-nudge Time
console.log('5. Verifying “missed must be greater than the re-nudge time” constraint...');
// Missed exactly equal to re-nudge (30 <= 30)
const missedEqualRenudge = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 10,
  missedMinutes: 30,
  renudgeMinutes: 30,
});
assert.equal(missedEqualRenudge.isValid, false);
assert.equal(
  missedEqualRenudge.error,
  'Missed must be greater than the re-nudge time (30 minutes).',
);
assert.ok(
  missedEqualRenudge.error?.toLowerCase().includes('missed must be greater than the re-nudge time'),
);

// Missed strictly less than custom re-nudge (e.g. renudge = 60, missed = 45)
const missedLessThanRenudge = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 10,
  missedMinutes: 45,
  renudgeMinutes: 60,
});
assert.equal(missedLessThanRenudge.isValid, false);
assert.equal(
  missedLessThanRenudge.error,
  'Missed must be greater than the re-nudge time (60 minutes).',
);

// Missed greater than re-nudge (renudge = 30, missed = 31 or 120)
const missedValidDefault = validateProfileSettings({
  name: 'Alex',
  snoozeMinutes: 10,
  missedMinutes: 31,
  renudgeMinutes: 30,
});
assert.equal(missedValidDefault.isValid, true);
assert.equal(missedValidDefault.missedMinutes, 31);
console.log('  ✓ Re-nudge vs missed constraint validated');

// 6. Row Update & Permission Check
console.log('6. Verifying row update check & permission error handling...');
// Case: 0 rows updated (e.g., user is not owner so RLS silently updated 0 rows)
const zeroRowsError = getUpdateErrorMessage(null, 0);
assert.ok(
  /You don['’]t have permission to change this profile\./.test(zeroRowsError || ''),
  `Expected permission error message, got: ${zeroRowsError}`,
);
assert.equal(zeroRowsError, PERMISSION_DENIED_MESSAGE);

// Case: Postgres 42501 permission error
const psqlPermissionError = getUpdateErrorMessage(
  { code: '42501', message: 'permission denied for table care_profiles' },
  0,
);
assert.equal(psqlPermissionError, PERMISSION_DENIED_MESSAGE);

// Case: Postgres RLS policy check violation
const rlsPolicyError = getUpdateErrorMessage(
  {
    code: '42501',
    message: 'new row violates row-level security policy for table "care_profiles"',
  },
  0,
);
assert.equal(rlsPolicyError, PERMISSION_DENIED_MESSAGE);

// Case: Raw database error (e.g. syntax or constraint) - must NOT expose raw database text
const rawDbError = getUpdateErrorMessage(
  { code: '23514', message: 'check constraint "care_profiles_missed_after_minutes_check" failed' },
  0,
);
assert.equal(rawDbError, GENERIC_UPDATE_ERROR_MESSAGE);
assert.ok(
  !rawDbError?.includes('check constraint'),
  'Raw Postgres error details must never be exposed',
);

// Case: 1 row updated successfully
const successResult = getUpdateErrorMessage(null, 1);
assert.equal(successResult, null, '1 row updated with no error must return null (success)');

console.log('  ✓ Row update check & permission masking validated');

console.log('\n=================================================================');
console.log('✅ ALL CARE PROFILE SETTINGS TESTS PASSED SUCCESSFULLY!');
console.log('=================================================================');
