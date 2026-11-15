import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';
import { redirectWithCookies } from '../src/lib/middleware-redirect.ts';

console.log('Testing redirectWithCookies preserves all session cookies...');

// 1. Create a simulated source response with refreshed session cookies
const source = NextResponse.next();
source.cookies.set('sb-fenqdaymgofxozjgcppt-auth-token', 'refreshed-jwt-access-token', {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
});
source.cookies.set('sb-fenqdaymgofxozjgcppt-auth-token.1', 'refreshed-jwt-chunk', {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
});
source.cookies.set('medbuddy_app_state', 'active-session-state', {
  httpOnly: true,
  sameSite: 'lax',
  path: '/app',
});

// 2. Perform redirect using redirectWithCookies
const redirectUrl = 'http://localhost:3000/app/setup';
const redirect = redirectWithCookies(redirectUrl, source);

// 3. Verify status & location
assert.equal(redirect.status, 307, 'Must be temporary redirect (307)');
assert.equal(redirect.headers.get('location'), redirectUrl, 'Location header must match target URL');

// 4. Verify all cookies survived onto the redirect response
const redirectCookies = redirect.cookies.getAll();
assert.equal(redirectCookies.length, 3, 'All 3 cookies must be preserved on redirect response');

const authToken = redirect.cookies.get('sb-fenqdaymgofxozjgcppt-auth-token');
assert.ok(authToken, 'Main auth token cookie must exist on redirect');
assert.equal(authToken.value, 'refreshed-jwt-access-token');

const chunkToken = redirect.cookies.get('sb-fenqdaymgofxozjgcppt-auth-token.1');
assert.ok(chunkToken, 'Auth token chunk cookie must exist on redirect');
assert.equal(chunkToken.value, 'refreshed-jwt-chunk');

const appState = redirect.cookies.get('medbuddy_app_state');
assert.ok(appState, 'App state cookie must exist on redirect');
assert.equal(appState.value, 'active-session-state');

console.log('✓ redirectWithCookies successfully preserved all cookies across redirect!');
