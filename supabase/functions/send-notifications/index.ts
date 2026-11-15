// Supabase Edge Function: send-notifications
// Triggered every minute by pg_cron / pg_net or internal schedulers
// Accepts only requests with a valid x-cron-secret header

import * as webpush from 'npm:web-push';
import { createClient } from 'npm:@supabase/supabase-js';

// Constant-time string equality to prevent timing attacks on CRON_SECRET
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.byteLength !== bBytes.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.byteLength; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

interface PushSubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

Deno.serve(async (req: Request) => {
  // 1. Authenticate caller via x-cron-secret header
  const expectedSecret = Deno.env.get('CRON_SECRET') || '';
  const providedSecret = req.headers.get('x-cron-secret') || '';

  if (!expectedSecret || !providedSecret || !timingSafeEqual(expectedSecret, providedSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Validate VAPID configuration upfront BEFORE claiming any notifications
  const vapidPublicKey =
    Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY') || Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || '';

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error(
      'Push sender aborted: Missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT',
    );
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  // 3. Initialize Supabase Service Role Client
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') || Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Push sender aborted: Missing Supabase database connection secrets');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 4. Claim pending notifications (up to 50, concurrency-safe via FOR UPDATE SKIP LOCKED)
  const { data: claimedRows, error: claimError } = await supabase.rpc('fn_claim_notifications', {
    p_limit: 50,
  });

  if (claimError) {
    console.error('Error claiming notifications:', claimError.code);
    return new Response(JSON.stringify({ error: 'Failed to claim notifications' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const notifications = claimedRows || [];
  let sentCount = 0;
  let failedCount = 0;
  let retriedCount = 0;

  // 5. Process each claimed notification
  for (const notif of notifications) {
    // Query eligible push subscriptions using the view (respects 1-hour cool-down and 7-day cutoff)
    const { data: subs, error: subError } = await supabase
      .from('eligible_push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', notif.user_id);

    if (subError) {
      console.error('Error querying subscriptions for notification id:', notif.id);
      retriedCount++;
      continue;
    }

    const eligibleSubs: PushSubRow[] = subs || [];

    // If user has zero eligible subscriptions, finish with 'no_subscription'
    if (eligibleSubs.length === 0) {
      await supabase.rpc('fn_finish_notification', {
        p_id: notif.id,
        p_ok: false,
        p_error: 'no_subscription',
      });
      failedCount++;
      continue;
    }

    // Determine urgency and TTL
    const isDoseAlert = ['dose_due', 'dose_renudge', 'dose_missed'].includes(notif.kind);
    const ttl = isDoseAlert ? 3600 : 86400;
    const urgency = isDoseAlert ? 'high' : 'normal';

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.body,
      tag: notif.dedupe_key,
      url: '/app',
    });

    let sentToAtLeastOne = false;

    // Send in parallel with a concurrency limit of 5 to avoid running past function timeout
    const CONCURRENCY_LIMIT = 5;
    for (let i = 0; i < eligibleSubs.length; i += CONCURRENCY_LIMIT) {
      const batch = eligibleSubs.slice(i, i + CONCURRENCY_LIMIT);
      const results = await Promise.all(
        batch.map(async (sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth_key,
            },
          };

          try {
            await webpush.sendNotification(pushSubscription, payload, {
              TTL: ttl,
              urgency,
            });

            // On success: reset failure counter, clear timestamps, set last_success_at
            await supabase.rpc('fn_record_push_success', { p_id: sub.id });
            return true;
          } catch (err: unknown) {
            const errorObj = err as { statusCode?: number };
            const statusCode = errorObj?.statusCode;

            if (statusCode === 404 || statusCode === 410) {
              // Dead / expired subscription: delete immediately
              console.log(`Deleting unsubscribed endpoint (${statusCode}) for sub:`, sub.id);
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            } else if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
              // VAPID or auth configuration issue: log status code only, do NOT penalize subscription
              console.warn(`Configuration/auth status (${statusCode}) for sub:`, sub.id);
            } else {
              // Transient failure (429, 5xx, network error): record failure
              console.warn(
                `Transient delivery failure (${statusCode || 'network'}) for sub:`,
                sub.id,
              );
              await supabase.rpc('fn_record_push_failure', { p_id: sub.id });
            }
            return false;
          }
        }),
      );

      if (results.some((res) => res === true)) {
        sentToAtLeastOne = true;
      }
    }

    if (sentToAtLeastOne) {
      await supabase.rpc('fn_finish_notification', {
        p_id: notif.id,
        p_ok: true,
      });
      sentCount++;
    } else {
      // All subscriptions experienced transient errors or 400/401/403:
      // Notification remains pending to be retried on next scheduler tick
      retriedCount++;
    }
  }

  // Log counts only (never log titles, bodies, medicine names, or user data)
  console.log('Finished send-notifications run:', {
    claimed: notifications.length,
    sent: sentCount,
    failed: failedCount,
    retried: retriedCount,
  });

  return new Response(
    JSON.stringify({
      claimed: notifications.length,
      sent: sentCount,
      failed: failedCount,
      retried: retriedCount,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});
