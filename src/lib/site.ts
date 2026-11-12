const DEFAULT_SITE_URL = 'https://medbuddy-s7ven.vercel.app';

function normalizeSiteUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_SITE_URL;
  try {
    return new URL(trimmed).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
