import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, Serwist, StaleWhileRevalidate } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope & typeof globalThis;

/**
 * Explicit Same-Origin Static Asset Caching Policy:
 *
 * Privacy & Security Principle:
 * Medical tracking data, dose history, and user authentication tokens are strictly private.
 * To ensure the service worker never inadvertently caches personal health records,
 * session cookies, or API responses, runtime caching is strictly restricted to same-origin
 * static assets only (immutable Next.js bundles, self-hosted web fonts, static images, and icons).
 *
 * The service worker will NEVER cache:
 * 1. Any cross-origin request (e.g. Supabase API *.supabase.co, CDNs, external services)
 * 2. Any request containing an Authorization header or credentials
 * 3. Any API, Auth, or Rest routes (/auth/, /rest/, /functions/, /api/)
 *
 * App shell and offline pages (/app, /offline) are precached via build-time precacheEntries.
 */

interface MatcherParams {
  request: Request;
  url: URL;
  sameOrigin: boolean;
}

function isSafeStaticAsset({ request, url, sameOrigin }: MatcherParams): boolean {
  // 1. Strictly require same-origin (blocks all *.supabase.co and external hosts)
  if (!sameOrigin) return false;

  // 2. Never cache any request carrying an Authorization header
  if (request.headers.has('Authorization')) return false;

  // 3. Never cache backend, API, or authentication endpoints
  const pathname = url.pathname;
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/rest/') ||
    pathname.startsWith('/functions/')
  ) {
    return false;
  }

  return true;
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Immutable Next.js static scripts and CSS bundles (/_next/static/)
    {
      matcher({ request, url, sameOrigin }: MatcherParams) {
        return (
          isSafeStaticAsset({ request, url, sameOrigin }) &&
          url.pathname.startsWith('/_next/static/')
        );
      },
      handler: new CacheFirst({
        cacheName: 'next-static-assets',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    // 2. Static images, illustrations, posters, and app icons
    {
      matcher({ request, url, sameOrigin }: MatcherParams) {
        return (
          isSafeStaticAsset({ request, url, sameOrigin }) &&
          (request.destination === 'image' ||
            url.pathname.startsWith('/icons/') ||
            url.pathname.startsWith('/posters/') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.webp') ||
            url.pathname.endsWith('.ico'))
        );
      },
      handler: new StaleWhileRevalidate({
        cacheName: 'static-image-assets',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // 3. Static self-hosted fonts
    {
      matcher({ request, url, sameOrigin }: MatcherParams) {
        return (
          isSafeStaticAsset({ request, url, sameOrigin }) &&
          (request.destination === 'font' ||
            url.pathname.endsWith('.woff2') ||
            url.pathname.endsWith('.woff') ||
            url.pathname.endsWith('.ttf'))
        );
      },
      handler: new CacheFirst({
        cacheName: 'static-font-assets',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();

/**
 * Push Notification Handlers
 *
 * Implements Web Push reception and notification click routing.
 * Ensures strict privacy: does not log payload details or private health information.
 */

interface PushEventPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
}

interface SwPushMessageData {
  json(): unknown;
  text(): string;
}

interface SwExtendableEvent extends Event {
  waitUntil(f: Promise<unknown>): void;
}

interface SwPushEvent extends SwExtendableEvent {
  readonly data?: SwPushMessageData | null;
}

interface SwNotificationEvent extends SwExtendableEvent {
  readonly action?: string;
  readonly notification: Notification & {
    data?: {
      url?: string;
    };
    close(): void;
  };
}

interface SwWindowClient {
  url: string;
  focus(): Promise<SwWindowClient>;
  navigate?(url: string): Promise<SwWindowClient | null>;
}

interface SwClients {
  matchAll(options?: { type?: string; includeUncontrolled?: boolean }): Promise<SwWindowClient[]>;
  openWindow?(url: string): Promise<SwWindowClient | null>;
}

interface SwRegistration {
  showNotification(title: string, options?: NotificationOptions): Promise<void>;
}

const swScope = self as unknown as {
  registration: SwRegistration;
  clients: SwClients;
};

self.addEventListener('push', ((event: SwPushEvent) => {
  if (!event.data) return;

  let payload: PushEventPayload = {};
  try {
    payload = event.data.json() as PushEventPayload;
  } catch {
    payload = {
      body: event.data.text(),
    };
  }

  const title = payload.title || 'MedBuddy Reminder';
  const options: NotificationOptions = {
    body: payload.body || 'You have a medicine reminder waiting.',
    tag: payload.tag || 'medbuddy-reminder',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
      url: payload.url || '/app',
    },
  };

  event.waitUntil(swScope.registration.showNotification(title, options));
}) as EventListener);

self.addEventListener('notificationclick', ((event: SwNotificationEvent) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app';

  event.waitUntil(
    swScope.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: SwWindowClient[]) => {
        for (const client of clientList) {
          if (client.url && client.url.includes('/app')) {
            return client.focus();
          }
          if (client.navigate) {
            return client.navigate(targetUrl).then((c) => c?.focus());
          }
        }
        if (swScope.clients.openWindow) {
          return swScope.clients.openWindow(targetUrl);
        }
      }),
  );
}) as EventListener);
