import assert from 'node:assert/strict';
import {
  signAppState,
  verifyAppState,
  APP_STATE_COOKIE_NAME,
} from '../src/lib/app-state-cookie.ts';

console.log('Testing Navigation Lookups & Cookie Caching...');
process.env.APP_COOKIE_SECRET =
  process.env.APP_COOKIE_SECRET || 'test-app-cookie-secret-that-is-at-least-32-chars-long!';
assert.equal(APP_STATE_COOKIE_NAME, 'medbuddy_app_state');

// Simulation of middleware execution
async function simulateNavigation({
  hasCookie,
  isCookieValid = true,
  user = { id: 'test-user-123' },
}) {
  let networkCalls = 0;

  // Call 1: Always performed for security
  networkCalls++; // supabase.auth.getUser()

  let cookieValue = null;
  if (hasCookie) {
    if (isCookieValid) {
      cookieValue = await signAppState({ uid: user.id, consent: true, setup: true });
    } else {
      cookieValue = 'invalid-tampered-token.12345';
    }
  }

  const verified = await verifyAppState(cookieValue, user.id);

  if (verified && verified.consent && verified.setup) {
    // Fast path: cached state is valid!
    return { networkCalls, state: verified, fastPath: true };
  }

  // Slow path: database queries required
  networkCalls++; // query consents
  networkCalls++; // query care_access

  return { networkCalls, state: { uid: user.id, consent: true, setup: true }, fastPath: false };
}

// 1. Initial navigation without cookie (Slow path)
const initialNav = await simulateNavigation({ hasCookie: false });
assert.equal(
  initialNav.networkCalls,
  3,
  'Initial navigation must make 3 network calls (getUser, consent, setup)',
);
assert.equal(initialNav.fastPath, false);
console.log(`✓ Initial navigation: ${initialNav.networkCalls} network calls (slow path)`);

// 2. Subsequent navigation with valid cached cookie (Fast path)
const cachedNav = await simulateNavigation({ hasCookie: true, isCookieValid: true });
assert.equal(
  cachedNav.networkCalls,
  1,
  'Cached navigation must make only 1 network call (getUser only)',
);
assert.equal(cachedNav.fastPath, true);
console.log(
  `✓ Cached navigation: ${cachedNav.networkCalls} network call (fast path - 66% reduction!)`,
);

// 3. Navigation with tampered cookie (Fails gracefully to Slow path)
const tamperedNav = await simulateNavigation({ hasCookie: true, isCookieValid: false });
assert.equal(
  tamperedNav.networkCalls,
  3,
  'Tampered cookie must trigger fresh database check (3 calls)',
);
assert.equal(tamperedNav.fastPath, false);
console.log(
  `✓ Tampered cookie fallback: ${tamperedNav.networkCalls} network calls (securely re-verified)`,
);

console.log('\nAll navigation lookup reduction tests passed!');
