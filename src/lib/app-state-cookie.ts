import type { NextResponse } from 'next/server.js';

export const APP_STATE_COOKIE_NAME = 'medbuddy_app_state';
export const APP_STATE_COOKIE_MAX_AGE = 600; // 10 minutes in seconds

export interface AppStatePayload {
  uid: string;
  consent: boolean;
  setup: boolean;
  exp: number; // Unix timestamp in milliseconds
}

function getCookieSecret(): string {
  return (
    process.env.APP_COOKIE_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'medbuddy-internal-cookie-secret'
  );
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
 */
export async function signAppState(
  state: { uid: string; consent: boolean; setup: boolean; exp?: number },
  secret = getCookieSecret(),
): Promise<string> {
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
 * Returns null if missing, expired, tampered, or mismatched with expectedUid.
 */
export async function verifyAppState(
  cookieValue: string | null | undefined,
  expectedUid: string,
  secret = getCookieSecret(),
): Promise<AppStatePayload | null> {
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
 */
export async function setAppStateCookie(
  response: NextResponse,
  state: { uid: string; consent: boolean; setup: boolean },
  isSecure = true,
): Promise<void> {
  const token = await signAppState(state);
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
