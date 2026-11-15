/**
 * Sanitizes a redirect destination path to prevent open redirect vulnerabilities.
 * Ensures the target path is strictly an internal route under /app.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') {
    return '/app';
  }

  // Reject excessively long input (prevent ReDoS or buffer abuse)
  if (value.length > 2048) {
    return '/app';
  }

  // Check for control characters or whitespace
  if (/[\x00-\x1F\x7F\s]/.test(value)) {
    return '/app';
  }

  // Check for backslashes, protocol schemes, protocol-relative prefixes
  if (value.includes('\\') || value.includes('://') || value.startsWith('//')) {
    return '/app';
  }

  // Decode percent-encoding and check again (prevent bypass via %2F%2F, %5C, etc.)
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Malformed URI sequence
    return '/app';
  }

  if (
    /[\x00-\x1F\x7F\s]/.test(decoded) ||
    decoded.includes('\\') ||
    decoded.includes('://') ||
    decoded.startsWith('//')
  ) {
    return '/app';
  }

  // Must start with /app (either exactly /app, /app/, or /app?...)
  if (value !== '/app' && !value.startsWith('/app/') && !value.startsWith('/app?')) {
    return '/app';
  }

  if (decoded !== '/app' && !decoded.startsWith('/app/') && !decoded.startsWith('/app?')) {
    return '/app';
  }

  // Path traversal check: ensure no '..' or '.' segments
  const beforeHash = value.split('#')[0] ?? '';
  const pathnameOnly = beforeHash.split('?')[0] ?? '';
  const segments = pathnameOnly.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg === '.') {
      return '/app';
    }
  }

  // Verify by attempting to parse as URL relative to a dummy origin
  try {
    const dummyOrigin = 'http://localhost';
    const parsed = new URL(value, dummyOrigin);
    if (parsed.origin !== dummyOrigin) {
      return '/app';
    }
    if (parsed.pathname !== '/app' && !parsed.pathname.startsWith('/app/')) {
      return '/app';
    }
  } catch {
    return '/app';
  }

  return value;
}
