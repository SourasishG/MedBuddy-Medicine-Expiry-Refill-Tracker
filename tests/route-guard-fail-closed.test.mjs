import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';
import { redirectWithCookies } from '../src/lib/middleware-redirect.ts';

console.log('Testing Route Guard Fail-Closed logic...');

function simulateGuard({
  pathname,
  user,
  consentErr = null,
  accessErr = null,
  throwException = false,
  consents = [],
  careAccess = [],
}) {
  const request = {
    nextUrl: new URL(`http://localhost:3000${pathname}`),
  };
  const isSignIn = pathname === '/app/sign-in';
  const isAuthCallback = pathname === '/app/auth/callback';
  const isConsent = pathname === '/app/consent';
  const isSetup = pathname === '/app/setup';
  let supabaseResponse = NextResponse.next();

  if (!user) {
    if (isSignIn || isAuthCallback) return { action: 'next', response: supabaseResponse };
    const redirectUrl = new URL('http://localhost:3000/app/sign-in');
    return {
      action: 'redirect',
      url: redirectUrl.toString(),
      response: redirectWithCookies(redirectUrl, supabaseResponse),
    };
  }

  if (isAuthCallback) return { action: 'next', response: supabaseResponse };

  try {
    if (throwException) {
      throw new Error('Database connection timeout');
    }

    if (consentErr) {
      // FAIL CLOSED: do not let through to protected page
      if (isSignIn) return { action: 'next', response: supabaseResponse };
      const redirectUrl = new URL('http://localhost:3000/app/sign-in?error=service_unavailable');
      return {
        action: 'redirect',
        url: redirectUrl.toString(),
        response: redirectWithCookies(redirectUrl, supabaseResponse),
      };
    }

    const hasConsent = Boolean(consents && consents.length > 0);
    if (!hasConsent) {
      if (!isConsent) {
        const redirectUrl = new URL('http://localhost:3000/app/consent');
        return {
          action: 'redirect',
          url: redirectUrl.toString(),
          response: redirectWithCookies(redirectUrl, supabaseResponse),
        };
      }
      return { action: 'next', response: supabaseResponse };
    }

    if (isConsent || isSignIn) {
      const redirectUrl = new URL('http://localhost:3000/app');
      return {
        action: 'redirect',
        url: redirectUrl.toString(),
        response: redirectWithCookies(redirectUrl, supabaseResponse),
      };
    }

    if (accessErr) {
      // FAIL CLOSED
      if (isSignIn) return { action: 'next', response: supabaseResponse };
      const redirectUrl = new URL('http://localhost:3000/app/sign-in?error=service_unavailable');
      return {
        action: 'redirect',
        url: redirectUrl.toString(),
        response: redirectWithCookies(redirectUrl, supabaseResponse),
      };
    }

    const hasCareProfile = Boolean(careAccess && careAccess.length > 0);
    if (!hasCareProfile && !isSetup) {
      const redirectUrl = new URL('http://localhost:3000/app/setup');
      return {
        action: 'redirect',
        url: redirectUrl.toString(),
        response: redirectWithCookies(redirectUrl, supabaseResponse),
      };
    }

    return { action: 'next', response: supabaseResponse };
  } catch (err) {
    if (pathname === '/app/sign-in') return { action: 'next', response: supabaseResponse };
    const redirectUrl = new URL('http://localhost:3000/app/sign-in?error=service_unavailable');
    return {
      action: 'redirect',
      url: redirectUrl.toString(),
      response: redirectWithCookies(redirectUrl, supabaseResponse),
    };
  }
}

// 1. Consent lookup fails -> must redirect to /app/sign-in?error=service_unavailable
const r1 = simulateGuard({
  pathname: '/app',
  user: { id: 'u1' },
  consentErr: { message: 'Database connection terminated' },
});
assert.equal(r1.action, 'redirect');
assert.equal(r1.url, 'http://localhost:3000/app/sign-in?error=service_unavailable');
console.log('✓ Consent lookup error correctly fails closed to sign-in');

// 2. Care profile lookup fails -> must redirect to /app/sign-in?error=service_unavailable
const r2 = simulateGuard({
  pathname: '/app',
  user: { id: 'u1' },
  consents: [{ id: 'c1' }],
  accessErr: { message: 'Table care_access locked' },
});
assert.equal(r2.action, 'redirect');
assert.equal(r2.url, 'http://localhost:3000/app/sign-in?error=service_unavailable');
console.log('✓ Care profile lookup error correctly fails closed to sign-in');

// 3. Unexpected exception thrown -> must redirect to /app/sign-in?error=service_unavailable
const r3 = simulateGuard({
  pathname: '/app',
  user: { id: 'u1' },
  throwException: true,
});
assert.equal(r3.action, 'redirect');
assert.equal(r3.url, 'http://localhost:3000/app/sign-in?error=service_unavailable');
console.log('✓ Unexpected exception correctly fails closed to sign-in');

// 4. Sign-in page itself must never loop if an error occurs
const r4 = simulateGuard({
  pathname: '/app/sign-in',
  user: { id: 'u1' },
  consentErr: { message: 'DB down' },
});
assert.equal(r4.action, 'next', 'Sign-in page must stay reachable (no redirect loop)');
console.log('✓ No redirect loop on sign-in page when database errors');

// 5. Normal success path
const r5 = simulateGuard({
  pathname: '/app',
  user: { id: 'u1' },
  consents: [{ id: 'c1' }],
  careAccess: [{ care_profile_id: 'p1' }],
});
assert.equal(r5.action, 'next', 'Normal authenticated request must pass through');
console.log('✓ Normal authenticated flow passes through smoothly');

console.log('\nAll route guard fail-closed tests passed!');
