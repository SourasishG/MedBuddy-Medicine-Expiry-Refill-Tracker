import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './lib/supabase/database.types';
import { safeNextPath } from './lib/safe-redirect';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  // Static files or Next internals inside /app if any
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.(png|jpg|jpeg|svg|webp|ico|json|webmanifest)$/i.test(pathname)
  ) {
    return supabaseResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthCallback = pathname === '/app/auth/callback';
  const isSignIn = pathname === '/app/sign-in';
  const isConsent = pathname === '/app/consent';
  const isSetup = pathname === '/app/setup';

  // 1. Unauthenticated users
  if (!user) {
    if (isSignIn || isAuthCallback) {
      return supabaseResponse;
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/app/sign-in';
    if (pathname !== '/app') {
      redirectUrl.searchParams.set('next', safeNextPath(pathname));
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated users on callback route
  if (isAuthCallback) {
    return supabaseResponse;
  }

  try {
    // 3. Check Consent
    const { data: consents, error: consentErr } = await supabase
      .from('consents')
      .select('id')
      .eq('user_id', user.id)
      .is('withdrawn_at', null)
      .limit(1);

    if (!consentErr) {
      const hasConsent = Boolean(consents && consents.length > 0);

      if (!hasConsent) {
        if (!isConsent) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/app/consent';
          return NextResponse.redirect(redirectUrl);
        }
        return supabaseResponse;
      }

      // If user has consent and is navigating to /app/consent or /app/sign-in
      if (isConsent || isSignIn) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/app';
        return NextResponse.redirect(redirectUrl);
      }
    }

    // 4. Check Care Profiles
    const { data: careAccess, error: accessErr } = await supabase
      .from('care_access')
      .select('care_profile_id')
      .eq('user_id', user.id)
      .limit(1);

    if (!accessErr) {
      const hasCareProfile = Boolean(careAccess && careAccess.length > 0);

      if (!hasCareProfile && !isSetup) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/app/setup';
        return NextResponse.redirect(redirectUrl);
      }
    }
  } catch (err) {
    // Defensive fallback: do not crash middleware on unexpected network blips
    console.error('Middleware guard error:', err);
  }

  return supabaseResponse;
}

export const config = {
  // Explicitly scoped ONLY to /app and /app/* routes.
  // Marketing routes (/, /privacy, /offline, etc.) are strictly excluded.
  matcher: ['/app', '/app/:path*'],
};
