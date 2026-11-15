import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';
import {
  signAppState,
  verifyAppState,
  setAppStateCookie,
  clearAppStateCookie,
  APP_STATE_COOKIE_NAME,
} from '../src/lib/app-state-cookie.ts';

console.log('Testing App State Cookie signing and verification...');

const uid = 'user-12345';
const secret = 'super-secret-test-key-32chars!';

// 1. Valid Token
const validToken = await signAppState({ uid, consent: true, setup: true }, secret);
const verified = await verifyAppState(validToken, uid, secret);
assert.ok(verified, 'Valid token must be verified');
assert.equal(verified.uid, uid);
assert.equal(verified.consent, true);
assert.equal(verified.setup, true);
assert.ok(verified.exp > Date.now());

// 2. Expired Token
const expiredToken = await signAppState(
  { uid, consent: true, setup: true, exp: Date.now() - 1000 },
  secret,
);
const expiredResult = await verifyAppState(expiredToken, uid, secret);
assert.equal(expiredResult, null, 'Expired token must return null');

// 3. Tampered Payload
const [, sig] = validToken.split('.');
const tamperedPayload = Buffer.from(
  JSON.stringify({ uid, consent: true, setup: true, exp: Date.now() + 100000 }),
).toString('base64url');
const tamperedToken = `${tamperedPayload}.${sig}`;
const tamperedResult = await verifyAppState(tamperedToken, uid, secret);
assert.equal(tamperedResult, null, 'Tampered token must fail HMAC check');

// 4. Mismatched UID
const otherUserResult = await verifyAppState(validToken, 'different-uid', secret);
assert.equal(otherUserResult, null, 'Token verified against different UID must return null');

// 5. Wrong Secret
const wrongSecretResult = await verifyAppState(validToken, uid, 'different-secret-key');
assert.equal(wrongSecretResult, null, 'Token verified with wrong secret must return null');

// 6. Malformed Tokens
assert.equal(await verifyAppState('', uid, secret), null);
assert.equal(await verifyAppState('no-dot-here', uid, secret), null);
assert.equal(await verifyAppState('a.b.c', uid, secret), null);
assert.equal(await verifyAppState(null, uid, secret), null);
assert.equal(await verifyAppState(undefined, uid, secret), null);

// 7. Cookie helper tests on NextResponse
const res = NextResponse.next();
await setAppStateCookie(res, { uid, consent: true, setup: false }, true);
const setCookie = res.cookies.get(APP_STATE_COOKIE_NAME);
assert.ok(setCookie, 'Cookie must be set on response');
assert.equal(setCookie.path, '/app');

clearAppStateCookie(res);
const clearedCookie = res.cookies.get(APP_STATE_COOKIE_NAME);
assert.equal(clearedCookie.maxAge, 0, 'Cleared cookie must have maxAge 0');

console.log('✓ All App State Cookie tests passed successfully!');
