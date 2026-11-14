import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('=== Phase B3: End-to-End Scheduler Delivery Verification ===\n');

async function main() {
  let testUserId = null;
  let testCareProfileId = null;
  let notificationId = null;

  try {
    // 1. Create a test user
    const testEmail = `e2e-scheduler-${Date.now()}@medbuddy.test`;
    console.log(`[Step 1] Creating test user: ${testEmail}`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Scheduler Tester' },
    });
    if (authError) throw authError;
    testUserId = authData.user.id;
    console.log(`  User ID: ${testUserId}`);

    // Brief wait for profile trigger
    await new Promise((r) => setTimeout(r, 600));

    // 2. Create care profile
    const { data: cpData, error: cpErr } = await supabase
      .from('care_profiles')
      .insert({ name: 'E2E Care Profile', created_by: testUserId })
      .select('id')
      .single();
    if (cpErr) throw cpErr;
    testCareProfileId = cpData.id;
    console.log(`  Care Profile ID: ${testCareProfileId}`);

    // 3. Create a pending notification created by hand
    const dedupeKey = `e2e-hand-crafted-${Date.now()}`;
    console.log(`\n[Step 2] Inserting hand-crafted pending notification...`);
    const { data: notifData, error: notifErr } = await supabase
      .from('notifications')
      .insert({
        user_id: testUserId,
        care_profile_id: testCareProfileId,
        kind: 'dose_due',
        dedupe_key: dedupeKey,
        title: 'Medication Reminder',
        body: 'Hand-crafted dose reminder for scheduler test',
        status: 'pending',
        send_after: new Date(Date.now() - 5000).toISOString(), // due immediately
      })
      .select('id, status, send_after, created_at')
      .single();

    if (notifErr) throw notifErr;
    notificationId = notifData.id;
    console.log(`  Notification ID: ${notificationId}`);
    console.log(`  Initial Status: ${notifData.status}`);
    console.log(`  Send After: ${notifData.send_after}`);

    // 4. Poll database every 5 seconds for up to 120 seconds (2 minutes)
    // to observe automated pickup and processing by medbuddy-send and send-notifications
    console.log(
      '\n[Step 3] Waiting for automated pg_cron + pg_net + send-notifications run (max 120s)...',
    );
    const startTime = Date.now();
    let finalStatus = null;
    let attemptsCount = 0;

    while (Date.now() - startTime < 125000) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const { data: currentNotif } = await supabase
        .from('notifications')
        .select('id, status, attempts, last_error, sent_at')
        .eq('id', notificationId)
        .single();

      if (currentNotif) {
        attemptsCount = currentNotif.attempts;
        if (currentNotif.status !== 'pending' || currentNotif.attempts > 0) {
          finalStatus = currentNotif;
          console.log(
            `  [+${elapsed}s] Notification picked up! Status: ${currentNotif.status}, Attempts: ${currentNotif.attempts}, Error: ${currentNotif.last_error || 'none'}`,
          );
          if (currentNotif.status !== 'pending') {
            break;
          }
        } else {
          process.stdout.write(`  [+${elapsed}s] Status: pending (attempts: 0)...\r`);
        }
      }

      await new Promise((r) => setTimeout(r, 5000));
    }

    console.log('\n\n=== End-to-End Delivery Verification Result ===');
    console.log(`Notification ID: ${notificationId}`);
    console.log(`Final Status: ${finalStatus?.status || 'pending'}`);
    console.log(`Attempts: ${finalStatus?.attempts || attemptsCount}`);
    console.log(
      `Processed by Scheduler: ${finalStatus && finalStatus.attempts > 0 ? 'YES' : 'NO'}`,
    );

    if (finalStatus && finalStatus.attempts > 0) {
      console.log('\n✓ Automated end-to-end delivery verified within 2 minutes!');
    } else {
      throw new Error('Notification was not picked up by scheduler within 2 minutes');
    }
  } finally {
    // Teardown
    console.log('\n[Teardown] Cleaning up test records...');
    if (notificationId) {
      await supabase.from('notifications').delete().eq('id', notificationId);
    }
    if (testCareProfileId) {
      await supabase.from('care_profiles').delete().eq('id', testCareProfileId);
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
    console.log('✓ Teardown complete.');
  }
}

main().catch((err) => {
  console.error('E2E Test Failed:', err.message);
  process.exit(1);
});
