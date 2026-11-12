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

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
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
    ].join('; '),
  },
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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);
