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

  // 2. Initialize Supabase Service Role Client
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') || Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 3. Configure Web Push VAPID keys
  const vapidPublicKey =
    Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY') || Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }

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
    // Query active push subscriptions with failure_count < 5
    const { data: subs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key, failure_count')
      .eq('user_id', notif.user_id)
      .lt('failure_count', 5);

    if (subError) {
      console.error('Error querying subscriptions for notification ID:', notif.id);
      retriedCount++;
      continue;
    }

    // If user has zero valid subscriptions, fail with 'no_subscription'
    if (!subs || subs.length === 0) {
      await supabase.rpc('fn_finish_notification', {
        p_id: notif.id,
        p_ok: false,
        p_error: 'no_subscription',
      });
      failedCount++;
      continue;
    }

    // Determine urgency and TTL per prompt spec:
    // urgency 'high' and TTL 3600 for dose_due, dose_renudge, dose_missed; TTL 86400 for rest
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

    for (const sub of subs) {
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

        sentToAtLeastOne = true;

        // Reset failure_count and update last_success_at
        await supabase
          .from('push_subscriptions')
          .update({
            failure_count: 0,
            last_success_at: new Date().toISOString(),
          })
          .eq('id', sub.id);
      } catch (err: unknown) {
        const errorObj = err as { statusCode?: number };
        const statusCode = errorObj?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Dead subscription: delete immediately
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          // Transient failure: increment failure count
          await supabase
            .from('push_subscriptions')
            .update({
              failure_count: (sub.failure_count || 0) + 1,
            })
            .eq('id', sub.id);
        }
      }
    }

    if (sentToAtLeastOne) {
      await supabase.rpc('fn_finish_notification', {
        p_id: notif.id,
        p_ok: true,
      });
      sentCount++;
    } else {
      // All subscriptions experienced transient errors:
      // Notification remains pending to be retried on next scheduler tick
      retriedCount++;
    }
  }

  // Log counts only (never log titles, bodies, medicine names, or health data)
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
    }
  );
});
