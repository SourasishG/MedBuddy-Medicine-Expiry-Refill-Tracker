import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

function hashFile(relPath: string): string {
  try {
    return crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(process.cwd(), relPath)))
      .digest('hex')
      .slice(0, 12);
  } catch {
    return 'v1';
  }
}

const offlineShellRevision = `${hashFile('src/app/layout.tsx')}-${hashFile('src/app/offline/page.tsx')}-${hashFile('src/app/app/page.tsx')}`;

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
  reloadOnOnline: true,
  manifestTransforms: [
    async (entries) => {
      const normalized = entries.map((entry) => ({
        ...entry,
        url: entry.url.replace(/\\/g, '/'),
      }));
      for (const url of ['/offline', '/app']) {
        if (!normalized.some((entry) => entry.url === url)) {
          normalized.push({ url, revision: offlineShellRevision, size: 0 });
        }
      }
      return { manifest: normalized, warnings: [] };
    },
  ],
});

const commonSecurityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
];

// 1. Strict CSP for marketing and public routes: strictly connect-src 'self'
const marketingCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// 2. Extended CSP for /app and /app/:path* with exact Supabase origin (no wildcards)
function getAppConnectSrc(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return "connect-src 'self'";
  try {
    const parsed = new URL(supabaseUrl);
    const httpsOrigin = `https://${parsed.host}`;
    const wssOrigin = `wss://${parsed.host}`;
    return `connect-src 'self' ${httpsOrigin} ${wssOrigin}`;
  } catch {
    return "connect-src 'self'";
  }
}

const appCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  getAppConnectSrc(),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      // Marketing routes: strictly excludes /app and /app/*
      {
        source: '/((?!app(?:/|$)).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: marketingCsp,
          },
          ...commonSecurityHeaders,
        ],
      },
      // Application routes: /app and /app/* with extended Supabase connect-src
      {
        source: '/app/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: appCsp,
          },
          ...commonSecurityHeaders,
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
