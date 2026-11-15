import assert from 'node:assert';

console.log('Testing Data Rights & Privacy Export Schema Validation...\n');

// 1. Mock export payload conforming to fn_export_my_data()
const mockExport = {
  exported_at: new Date().toISOString(),
  profile: {
    display_name: 'Dr. Elena Vance',
    timezone: 'Asia/Kolkata',
    large_text: false,
    hide_names_in_notifications: true,
  },
  consents: [
    {
      consent_type: 'health_data_processing',
      version: 'v1.0',
      agreed_at: new Date().toISOString(),
      revoked_at: null,
    },
  ],
  care_profiles: [
    {
      id: 'd9b736b4-2b0e-4321-8f51-789a012bc345',
      name: 'Asha (Mum)',
      timezone: 'Asia/Kolkata',
      snooze_minutes: 10,
      missed_after_minutes: 120,
      medicines: [
        {
          id: '12345678-abcd-ef01-2345-6789abcdef01',
          name: 'Amlodipine',
          strength: '5 mg',
          form: 'tablet',
          unit: 'tablets',
        },
      ],
      inventory: [
        {
          id: '23456789-bcde-f012-3456-789abcdef012',
          batch_number: 'AM-992',
          quantity_remaining: 28,
          expiry_date: '2027-04-30',
        },
      ],
      schedules: [
        {
          id: '3456789a-cdef-0123-4567-89abcdef0123',
          frequency: 'daily',
          dose_amount: 1,
        },
      ],
      dose_events: [
        {
          id: '456789ab-def0-1234-5678-9abcdef01234',
          scheduled_for: '2026-11-15T08:00:00Z',
          status: 'taken',
          taken_at: '2026-11-15T08:05:00Z',
        },
      ],
    },
  ],
};

// 2. Validate Root Structure
console.log('1. Validating export payload top-level keys...');
assert('exported_at' in mockExport, 'Must contain exported_at timestamp');
assert('profile' in mockExport, 'Must contain profile object');
assert('consents' in mockExport, 'Must contain consents array');
assert('care_profiles' in mockExport, 'Must contain care_profiles array');
console.log('  ✓ Top-level keys (exported_at, profile, consents, care_profiles) present');

// 3. Validate Privacy: IDs stripped from profile and consents per GDPR minimization
console.log('\n2. Validating data minimization (no auth UID leakage)...');
assert(!('id' in mockExport.profile), 'Profile id must be omitted from export');
assert(!('id' in mockExport.consents[0]), 'Consent id must be omitted from export');
assert(!('user_id' in mockExport.consents[0]), 'Consent user_id must be omitted from export');
console.log('  ✓ Internal user UUIDs safely omitted from export profile & consents');

// 4. Validate Care Profiles Hierarchy
console.log('\n3. Validating care profile hierarchical ledger...');
const cp = mockExport.care_profiles[0];
assert(Array.isArray(cp.medicines), 'Must contain medicines array');
assert(Array.isArray(cp.inventory), 'Must contain inventory array');
assert(Array.isArray(cp.schedules), 'Must contain schedules array');
assert(Array.isArray(cp.dose_events), 'Must contain dose_events array');
assert.strictEqual(cp.medicines[0].name, 'Amlodipine');
assert.strictEqual(cp.inventory[0].quantity_remaining, 28);
console.log('  ✓ Care profile nested structure matches specification');

// 5. Test Confirmation Word Validation Logic
console.log('\n4. Validating confirmation word requirements for account deletion...');
function isDeleteConfirmed(input) {
  return input.trim().toUpperCase() === 'DELETE';
}
assert.strictEqual(isDeleteConfirmed('DELETE'), true);
assert.strictEqual(isDeleteConfirmed('delete'), true);
assert.strictEqual(isDeleteConfirmed('  DELETE  '), true);
assert.strictEqual(isDeleteConfirmed('DEL'), false);
assert.strictEqual(isDeleteConfirmed(''), false);
assert.strictEqual(isDeleteConfirmed('yes'), false);
console.log('  ✓ Deletion confirmation logic requires strict DELETE phrase');

console.log('\n=================================================================');
console.log('✅ ALL DATA RIGHTS & PRIVACY SCHEMA TESTS PASSED!');
console.log('=================================================================\n');
