import type { NextResponse } from 'next/server.js';

export const APP_STATE_COOKIE_NAME = 'medbuddy_app_state';
export const APP_STATE_COOKIE_MAX_AGE = 600; // 10 minutes in seconds
export const MIN_COOKIE_SECRET_LENGTH = 32;

export interface AppStatePayload {
  uid: string;
  consent: boolean;
  setup: boolean;
  exp: number; // Unix timestamp in milliseconds
}

let hasLoggedSecretWarning = false;

export function warnInvalidCookieSecret(): void {
  if (!hasLoggedSecretWarning) {
    hasLoggedSecretWarning = true;
    console.error(
      'APP_COOKIE_SECRET is missing or shorter than 32 characters; state cookie caching disabled and falling back to database checks.',
    );
  }
}

export function _resetCookieSecretWarningForTesting(): void {
  hasLoggedSecretWarning = false;
}

/**
 * Returns the configured APP_COOKIE_SECRET if valid (>= 32 chars), or null.
 * Logs a safe error message once if missing or too short.
 * Never falls back to public anon keys or hard-coded strings.
 */
export function getCookieSecret(): string | null {
  const secret = process.env.APP_COOKIE_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < MIN_COOKIE_SECRET_LENGTH) {
    warnInvalidCookieSecret();
    return null;
  }
  return secret;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Signs the app state payload into a base64.signature token.
 * Returns null if APP_COOKIE_SECRET is missing or shorter than 32 characters.
 */
export async function signAppState(
  state: { uid: string; consent: boolean; setup: boolean; exp?: number },
  customSecret?: string | null,
): Promise<string | null> {
  const secret = customSecret !== undefined ? customSecret : getCookieSecret();
  if (!secret || secret.length < MIN_COOKIE_SECRET_LENGTH) {
    warnInvalidCookieSecret();
    return null;
  }

  const payload: AppStatePayload = {
    uid: state.uid,
    consent: Boolean(state.consent),
    setup: Boolean(state.setup),
    exp: state.exp ?? Date.now() + APP_STATE_COOKIE_MAX_AGE * 1000,
  };

  const jsonStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonStr, 'utf-8').toString('base64url');

  const encoder = new TextEncoder();
  const key = await getHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(base64Payload));
  const hexSignature = Buffer.from(signatureBuffer).toString('hex');

  return `${base64Payload}.${hexSignature}`;
}

/**
 * Verifies and parses the app state cookie.
 * Returns null if missing, expired, tampered, mismatched with expectedUid,
 * or if APP_COOKIE_SECRET is missing or shorter than 32 characters.
 */
export async function verifyAppState(
  cookieValue: string | null | undefined,
  expectedUid: string,
  customSecret?: string | null,
): Promise<AppStatePayload | null> {
  const secret = customSecret !== undefined ? customSecret : getCookieSecret();
  if (!secret || secret.length < MIN_COOKIE_SECRET_LENGTH) {
    warnInvalidCookieSecret();
    return null;
  }

  if (!cookieValue || typeof cookieValue !== 'string') {
    return null;
  }

  const parts = cookieValue.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [base64Payload, hexSignature] = parts;
  if (!base64Payload || !hexSignature || hexSignature.length !== 64) {
    return null;
  }

  try {
    const encoder = new TextEncoder();
    const key = await getHmacKey(secret);
    const signatureBuffer = Buffer.from(hexSignature, 'hex');

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      encoder.encode(base64Payload),
    );

    if (!isValid) {
      return null;
    }

    const jsonStr = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    const parsed = JSON.parse(jsonStr) as AppStatePayload;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.uid !== expectedUid ||
      typeof parsed.consent !== 'boolean' ||
      typeof parsed.setup !== 'boolean' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }

    // Check expiration
    if (Date.now() >= parsed.exp) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Sets the short-lived medbuddy_app_state cookie on a response.
 * Never sets the cookie if APP_COOKIE_SECRET is missing or shorter than 32 characters.
 */
export async function setAppStateCookie(
  response: NextResponse,
  state: { uid: string; consent: boolean; setup: boolean },
  isSecure = true,
  customSecret?: string | null,
): Promise<void> {
  const token = await signAppState(state, customSecret);
  if (!token) {
    // Secret missing or too short: never set the cookie
    return;
  }
  response.cookies.set(APP_STATE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/app',
    maxAge: APP_STATE_COOKIE_MAX_AGE,
  });
}

/**
 * Clears the medbuddy_app_state cookie from a response.
 */
export function clearAppStateCookie(response: NextResponse): void {
  response.cookies.set(APP_STATE_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/app',
    maxAge: 0,
  });
}
