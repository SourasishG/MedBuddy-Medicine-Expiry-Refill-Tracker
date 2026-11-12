import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://medbuddy.app';
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/app', '/privacy'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
