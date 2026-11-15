import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';
import {
  signAppState,
  verifyAppState,
  setAppStateCookie,
  clearAppStateCookie,
  APP_STATE_COOKIE_NAME,
  MIN_COOKIE_SECRET_LENGTH,
  _resetCookieSecretWarningForTesting,
} from '../src/lib/app-state-cookie.ts';

console.log('Testing App State Cookie signing, verification, and secret enforcement...');

const uid = 'user-12345';
const validSecret = 'super-secret-test-key-32chars-long-secure-token!';
assert.ok(validSecret.length >= MIN_COOKIE_SECRET_LENGTH);

// 1. Valid Token with valid secret (>= 32 chars)
const validToken = await signAppState({ uid, consent: true, setup: true }, validSecret);
assert.ok(validToken, 'Must generate valid token with 32+ char secret');
const verified = await verifyAppState(validToken, uid, validSecret);
assert.ok(verified, 'Valid token must be verified');
assert.equal(verified.uid, uid);
assert.equal(verified.consent, true);
assert.equal(verified.setup, true);
assert.ok(verified.exp > Date.now());

// 2. Missing Secret Case: must never set or trust cookie
const savedEnv = process.env.APP_COOKIE_SECRET;
try {
  delete process.env.APP_COOKIE_SECRET;
  _resetCookieSecretWarningForTesting();

  // Signing without secret must return null
  const missingSecretToken = await signAppState({ uid, consent: true, setup: true });
  assert.equal(missingSecretToken, null, 'Must return null when secret is missing');

  // Verifying without secret must return null
  const missingSecretVerify = await verifyAppState(validToken, uid);
  assert.equal(missingSecretVerify, null, 'Must return null when secret is missing');

  // Setting cookie without secret must NOT set cookie on response
  const noSecretRes = NextResponse.next();
  await setAppStateCookie(noSecretRes, { uid, consent: true, setup: true }, true);
  assert.equal(
    noSecretRes.cookies.get(APP_STATE_COOKIE_NAME),
    undefined,
    'Cookie must never be set if APP_COOKIE_SECRET is missing',
  );
} finally {
  if (savedEnv) process.env.APP_COOKIE_SECRET = savedEnv;
}

// 3. Too-short Secret Case (< 32 chars): must never set or trust cookie
const shortSecret = 'too-short-secret';
assert.ok(shortSecret.length < MIN_COOKIE_SECRET_LENGTH);

const shortSecretToken = await signAppState({ uid, consent: true, setup: true }, shortSecret);
assert.equal(shortSecretToken, null, 'Must return null when secret is shorter than 32 characters');

const shortSecretVerify = await verifyAppState(validToken, uid, shortSecret);
assert.equal(shortSecretVerify, null, 'Must return null when secret is shorter than 32 characters');

const shortSecretRes = NextResponse.next();
await setAppStateCookie(shortSecretRes, { uid, consent: true, setup: true }, true, shortSecret);
assert.equal(
  shortSecretRes.cookies.get(APP_STATE_COOKIE_NAME),
  undefined,
  'Cookie must never be set if secret is shorter than 32 characters',
);

// 4. Expired Token
const expiredToken = await signAppState(
  { uid, consent: true, setup: true, exp: Date.now() - 1000 },
  validSecret,
);
const expiredResult = await verifyAppState(expiredToken, uid, validSecret);
assert.equal(expiredResult, null, 'Expired token must return null');

// 5. Tampered Payload
const [, sig] = validToken.split('.');
const tamperedPayload = Buffer.from(
  JSON.stringify({ uid, consent: true, setup: true, exp: Date.now() + 100000 }),
).toString('base64url');
const tamperedToken = `${tamperedPayload}.${sig}`;
const tamperedResult = await verifyAppState(tamperedToken, uid, validSecret);
assert.equal(tamperedResult, null, 'Tampered token must fail HMAC check');

// 6. Mismatched UID
const otherUserResult = await verifyAppState(validToken, 'different-uid', validSecret);
assert.equal(otherUserResult, null, 'Token verified against different UID must return null');

// 7. Wrong Secret (>= 32 chars but different)
const differentValidSecret = 'different-secret-key-that-is-also-32chars!';
const wrongSecretResult = await verifyAppState(validToken, uid, differentValidSecret);
assert.equal(wrongSecretResult, null, 'Token verified with wrong secret must return null');

// 8. Malformed Tokens
assert.equal(await verifyAppState('', uid, validSecret), null);
assert.equal(await verifyAppState('no-dot-here', uid, validSecret), null);
assert.equal(await verifyAppState('a.b.c', uid, validSecret), null);
assert.equal(await verifyAppState(null, uid, validSecret), null);
assert.equal(await verifyAppState(undefined, uid, validSecret), null);

// 9. Cookie helper tests on NextResponse with valid secret
const res = NextResponse.next();
await setAppStateCookie(res, { uid, consent: true, setup: false }, true, validSecret);
const setCookie = res.cookies.get(APP_STATE_COOKIE_NAME);
assert.ok(setCookie, 'Cookie must be set on response when secret is valid');
assert.equal(setCookie.path, '/app');

clearAppStateCookie(res);
const clearedCookie = res.cookies.get(APP_STATE_COOKIE_NAME);
assert.equal(clearedCookie.maxAge, 0, 'Cleared cookie must have maxAge 0');

console.log(
  '✓ All App State Cookie tests (including missing & short secret cases) passed successfully!',
);
