/**
 * Web Push and Device Installation Utility Functions
 *
 * Provides typed abstractions for VAPID conversion, device detection,
 * service worker push registration, and subscription persistence to Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface DeviceInstallState {
  isStandalone: boolean;
  isIos: boolean;
  isIosSafari: boolean;
  isAndroid: boolean;
  needsIosInstallForPush: boolean;
}

/**
 * Converts a URL-safe Base64 string to a Uint8Array.
 * Required for passing VAPID public key to PushManager.subscribe.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  if (typeof window === 'undefined') {
    // Node.js test environment support
    const rawData = Buffer.from(base64, 'base64').toString('binary');
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether Web Push and Service Workers are supported in the current environment.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Detects current device platform and installation state.
 */
export function getDeviceInstallState(customUserAgent?: string): DeviceInstallState {
  if (typeof window === 'undefined') {
    return {
      isStandalone: false,
      isIos: false,
      isIosSafari: false,
      isAndroid: false,
      needsIosInstallForPush: false,
    };
  }

  const ua = customUserAgent || navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);

  // Standalone detection (iOS Safari navigator.standalone or display-mode: standalone media query)
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  // iOS Safari detection (excluding Chrome/Firefox on iOS which have CriOS/FxiOS)
  const isIosSafari =
    isIos &&
    /Safari/i.test(ua) &&
    !/CriOS/i.test(ua) &&
    !/FxiOS/i.test(ua) &&
    !/EdgiOS/i.test(ua);

  // On iOS, Web Push is only supported when the web app is installed to the Home Screen (iOS 16.4+)
  const needsIosInstallForPush = isIos && !isStandalone;

  return {
    isStandalone,
    isIos,
    isIosSafari,
    isAndroid,
    needsIosInstallForPush,
  };
}

/**
 * Returns current notification permission status.
 */
export function getNotificationPermissionStatus(): NotificationPermissionStatus {
  if (!isPushSupported()) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionStatus;
}

/**
 * Retrieves the active Service Worker registration.
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current Web Push subscription if one exists.
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await getServiceWorkerRegistration();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export interface SubscribeResult {
  ok: boolean;
  status: NotificationPermissionStatus;
  error?: string;
  subscription?: PushSubscription;
}

/**
 * Requests notification permission, subscribes via PushManager with VAPID key,
 * and upserts the subscription record to Supabase push_subscriptions table.
 */
export async function subscribeToPush(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SubscribeResult> {
  if (!isPushSupported()) {
    return {
      ok: false,
      status: 'unsupported',
      error: 'Web Push notifications are not supported on this browser or device.',
    };
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return {
      ok: false,
      status: getNotificationPermissionStatus(),
      error: 'VAPID public key is not configured on this server.',
    };
  }

  try {
    // 1. Request permission if not already granted
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return {
        ok: false,
        status: permission as NotificationPermissionStatus,
        error:
          permission === 'denied'
            ? 'Notifications are blocked in your browser settings. Please allow notifications to receive reminders.'
            : 'Notification permission was not granted.',
      };
    }

    // 2. Obtain service worker registration
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      return {
        ok: false,
        status: 'granted',
        error: 'Service worker is not ready yet. Please try again in a few moments.',
      };
    }

    // 3. Subscribe or reuse existing subscription
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    // 4. Extract keys and upsert to database
    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh;
    const authKey = json.keys?.auth;

    if (!p256dh || !authKey) {
      return {
        ok: false,
        status: 'granted',
        error: 'Could not extract encryption keys from push subscription.',
      };
    }

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : '';

    const { error: dbError } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh,
        auth_key: authKey,
        user_agent: userAgent,
      },
      { onConflict: 'endpoint' },
    );

    if (dbError) {
      return {
        ok: false,
        status: 'granted',
        error: `Could not save push subscription: ${dbError.message}`,
      };
    }

    return {
      ok: true,
      status: 'granted',
      subscription,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown push subscription error';
    return {
      ok: false,
      status: getNotificationPermissionStatus(),
      error: `Failed to subscribe: ${message}`,
    };
  }
}

/**
 * Unsubscribes the current device from PushManager and deletes its record in Supabase.
 */
export async function unsubscribeFromPush(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const subscription = await getCurrentPushSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Clean up from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    }
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during unsubscribe';
    return { ok: false, error: message };
  }
}

/**
 * Dispatches an immediate test notification through the local service worker registration.
 */
export async function sendLocalTestNotification(): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  const registration = await getServiceWorkerRegistration();
  if (registration) {
    await registration.showNotification('MedBuddy Test Reminder', {
      body: 'Your dose reminders and notifications are working properly.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'medbuddy-test-reminder',
      data: { url: '/app' },
    });
    return true;
  }

  // Fallback to Notification API directly if registration is somehow unavailable
  new Notification('MedBuddy Test Reminder', {
    body: 'Your dose reminders and notifications are working properly.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'medbuddy-test-reminder',
  });
  return true;
}
