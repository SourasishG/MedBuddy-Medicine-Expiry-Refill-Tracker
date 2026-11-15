import assert from 'node:assert/strict';
import {
  computeDaysLeft,
  getExpiryBand,
  getExpiryMeta,
  getEffectiveExpiryDate,
  parseExpiryInput,
  isPastExpiry,
  formatRefillHint,
} from '../src/features/medicines/expiry-utils.ts';

console.log('Testing Expiry & Medicine Utility functions...\n');

// 1. Expiry Band boundaries
console.log('1. Verifying Expiry Bands boundaries...');
assert.equal(getExpiryBand(-1), 'expired');
assert.equal(getExpiryBand(-10), 'expired');
assert.equal(getExpiryBand(0), 'urgent');
assert.equal(getExpiryBand(5), 'urgent');
assert.equal(getExpiryBand(7), 'urgent');
assert.equal(getExpiryBand(8), 'soon');
assert.equal(getExpiryBand(20), 'soon');
assert.equal(getExpiryBand(30), 'soon');
assert.equal(getExpiryBand(31), 'fresh');
assert.equal(getExpiryBand(180), 'fresh');
console.log('  ✓ All 4 expiry bands (expired, urgent, soon, fresh) correct');

// 2. Metadata formatting
console.log('2. Verifying Expiry Metadata text & labels...');
const metaExpired = getExpiryMeta(-5);
assert.equal(metaExpired.band, 'expired');
assert.equal(metaExpired.label, 'Expired');
assert.equal(metaExpired.humanText, 'Expired 5d ago');

const metaUrgent = getExpiryMeta(5);
assert.equal(metaUrgent.band, 'urgent');
assert.equal(metaUrgent.label, 'Urgent');
assert.equal(metaUrgent.humanText, '5d left');

const metaSoon = getExpiryMeta(15);
assert.equal(metaSoon.band, 'soon');
assert.equal(metaSoon.label, 'Soon');
assert.equal(metaSoon.humanText, '15d left');

const metaFresh = getExpiryMeta(90);
assert.equal(metaFresh.band, 'fresh');
assert.equal(metaFresh.label, 'Fresh');
assert.equal(metaFresh.humanText, '90d left');
console.log('  ✓ Expiry metadata formatting verified');

// 3. Month/Year parsing to end of month
console.log('3. Verifying parseExpiryInput converts YYYY-MM to end of month...');
assert.equal(parseExpiryInput('2027-05'), '2027-05-31', 'May has 31 days');
assert.equal(parseExpiryInput('2027-04'), '2027-04-30', 'April has 30 days');
assert.equal(parseExpiryInput('2028-02'), '2028-02-29', 'Leap year Feb 2028 has 29 days');
assert.equal(parseExpiryInput('2027-02'), '2027-02-28', 'Non-leap year Feb 2027 has 28 days');
assert.equal(parseExpiryInput('2026-12-15'), '2026-12-15', 'Full dates preserved as-is');
console.log('  ✓ Month/Year parsing verified');

// 4. Effective expiry with opened date and shelf life
console.log('4. Verifying effective expiry with opened_on + shelf life...');
// Case: opened expiry is sooner than box expiry
const soonerOpened = getEffectiveExpiryDate('2027-12-31', '2026-11-01', 30);
assert.equal(soonerOpened, '2026-12-01', 'Opened expiry (30 days) should override 2027-12-31');

// Case: box expiry is sooner than opened expiry
const soonerBox = getEffectiveExpiryDate('2026-11-10', '2026-11-01', 60);
assert.equal(soonerBox, '2026-11-10', 'Box expiry should override longer opened expiry');
console.log('  ✓ Effective expiry calculation verified');

// 5. Refill hints
console.log('5. Verifying Refill Hints from supply & usage...');
const outOfStock = formatRefillHint({ remaining: 0 });
assert.equal(outOfStock, 'Out of stock. Refill needed.');

const lowDays = formatRefillHint({
  remaining: 10,
  dailyUsage: 2,
  daysOfSupply: 5,
  unit: 'tablets',
});
assert.ok(lowDays.includes('About 5 days left. Refill soon.'));

const healthySupply = formatRefillHint({
  remaining: 60,
  dailyUsage: 2,
  daysOfSupply: 30,
  unit: 'tablets',
});
assert.ok(healthySupply.includes('About 30 days of supply left.'));

const prnLow = formatRefillHint({ remaining: 3, unit: 'capsules' });
assert.equal(prnLow, 'Low stock: 3 capsules left.');
console.log('  ✓ Refill hints verified');

// 6. Days left calculation & Past expiry check
console.log('6. Verifying computeDaysLeft and isPastExpiry...');
const futureDate = '2099-01-01';
const pastDate = '2020-01-01';
assert.ok(computeDaysLeft(futureDate) > 1000);
assert.ok(computeDaysLeft(pastDate) < -1000);
assert.equal(isPastExpiry(pastDate), true);
assert.equal(isPastExpiry(futureDate), false);
console.log('  ✓ computeDaysLeft and isPastExpiry verified');

console.log('\n=================================================================');
console.log('✅ ALL EXPIRY & MEDICINE UTILITY TESTS PASSED!');
console.log('=================================================================');
