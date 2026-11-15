import { NextResponse } from 'next/server.js';

/**
 * Creates a redirect response while preserving all cookies set on the source response
 * (such as refreshed Supabase auth session tokens).
 */
export function redirectWithCookies(
  url: URL | string,
  sourceResponse: NextResponse,
  status = 307,
): NextResponse {
  const redirectResponse = NextResponse.redirect(url, { status });
  const allCookies = sourceResponse.cookies.getAll();
  for (const cookie of allCookies) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}
