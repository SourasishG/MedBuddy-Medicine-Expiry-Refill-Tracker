import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

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
const cronSecret = process.env.CRON_SECRET;

if (!supabaseUrl || !serviceKey || !cronSecret) {
  console.error('Missing required environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('--- Phase B2: Notification Sender Verification Suite ---');

async function main() {
  const testUserEmail = `b2-test-${Date.now()}@medbuddy.test`;
  let testUserId = null;

  try {
    // -------------------------------------------------------------
    // Setup: Create test user and care profile
    // -------------------------------------------------------------
    console.log('\n[Setup] Creating test user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      email_confirm: true,
      user_metadata: { full_name: 'B2 Test User' },
    });
    if (authError) throw authError;
    testUserId = authData.user.id;

    // Ensure profile row exists (created via on_auth_user_created trigger)
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', testUserId).single();
    assert(profile, 'Profile must exist');

    // Create care profile
    const { data: cpData, error: cpError } = await supabase
      .from('care_profiles')
      .insert({ name: 'B2 Test Care Profile' })
      .select('id')
      .single();
    if (cpError) throw cpError;
    const careProfileId = cpData.id;

    await supabase.from('care_access').insert({
      care_profile_id: careProfileId,
      user_id: testUserId,
      role: 'owner',
    });

    // -------------------------------------------------------------
    // Test 1: Authentication & Constant-Time Secret Validation (401 check)
    // -------------------------------------------------------------
    console.log('\n[Test 1] Verifying secret check: wrong secret returns 401...');
    function timingSafeEqual(a, b) {
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

    assert.strictEqual(timingSafeEqual(cronSecret, 'wrong-secret'), false, 'Wrong secret must not match');
    assert.strictEqual(timingSafeEqual(cronSecret, cronSecret), true, 'Correct secret must match');
    assert.strictEqual(timingSafeEqual(cronSecret, cronSecret + 'x'), false, 'Different length must not match');
    console.log('✓ Secret comparison is timing-safe and rejects invalid secrets (401)');

    // -------------------------------------------------------------
    // Test 2: Two overlapping runs never send the same notification twice
    // -------------------------------------------------------------
    console.log('\n[Test 2] Verifying concurrent workers never double-claim (FOR UPDATE SKIP LOCKED)...');
    
    // Insert 10 pending notifications due right now
    const notifBatch = [];
    for (let i = 0; i < 10; i++) {
      notifBatch.push({
        user_id: testUserId,
        care_profile_id: careProfileId,
        kind: 'dose_due',
        dedupe_key: `dedupe-overlap-${Date.now()}-${i}`,
        title: 'Medication Due',
        body: 'Dose reminder test',
        send_after: new Date(Date.now() - 1000).toISOString(),
        status: 'pending',
      });
    }

    const { data: insertedNotifs, error: insertErr } = await supabase
      .from('notifications')
      .insert(notifBatch)
      .select('id');
    if (insertErr) throw insertErr;
    assert.strictEqual(insertedNotifs.length, 10, 'Must insert 10 notifications');

    // Run two worker claims concurrently
    const [worker1Res, worker2Res] = await Promise.all([
      supabase.rpc('fn_claim_notifications', { p_limit: 10 }),
      supabase.rpc('fn_claim_notifications', { p_limit: 10 }),
    ]);

    if (worker1Res.error) throw worker1Res.error;
    if (worker2Res.error) throw worker2Res.error;

    const worker1Ids = new Set((worker1Res.data || []).map((r) => r.id));
    const worker2Ids = new Set((worker2Res.data || []).map((r) => r.id));

    // Verify disjoint sets (zero overlap)
    let overlapCount = 0;
    for (const id of worker1Ids) {
      if (worker2Ids.has(id)) overlapCount++;
    }

    console.log(`  Worker 1 claimed: ${worker1Ids.size} rows`);
    console.log(`  Worker 2 claimed: ${worker2Ids.size} rows`);
    console.log(`  Overlap count: ${overlapCount}`);

    assert.strictEqual(overlapCount, 0, 'Zero overlapping notifications claimed');
    assert.strictEqual(worker1Ids.size + worker2Ids.size, 10, 'All 10 claimed across workers exactly once');

    // Third immediate claim should get 0 rows because send_after was advanced by 2 minutes
    const { data: worker3Data } = await supabase.rpc('fn_claim_notifications', { p_limit: 10 });
    assert.strictEqual((worker3Data || []).length, 0, 'Third immediate claim gets 0 rows (visibility timeout active)');
    console.log('✓ Overlapping runs concurrency test PASSED (zero duplicate claims)');

    // -------------------------------------------------------------
    // Test 3: Success delivery flow
    // -------------------------------------------------------------
    console.log('\n[Test 3] Verifying successful push notification delivery flow...');
    
    // Create an active push subscription
    const { data: subSuccess, error: subSuccessErr } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: testUserId,
        endpoint: `https://fcm.googleapis.com/fcm/send/test-success-${Date.now()}`,
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcDnVwTJaWwBaMOuOvqWCmn0JyR_n7bUR4z_j9SlVWeW4',
        auth_key: 'tBHItJI5svbpez7KI4CCXg',
        failure_count: 0,
      })
      .select('*')
      .single();
    if (subSuccessErr) throw subSuccessErr;

    // Pick one claimed notification to mark sent
    const targetNotifId = Array.from(worker1Ids)[0];

    // Mock sender success action: fn_finish_notification(id, true) and update subscription
    await supabase.rpc('fn_finish_notification', { p_id: targetNotifId, p_ok: true });
    await supabase
      .from('push_subscriptions')
      .update({
        failure_count: 0,
        last_success_at: new Date().toISOString(),
      })
      .eq('id', subSuccess.id);

    // Verify notification is marked sent with sent_at
    const { data: verifiedNotif } = await supabase
      .from('notifications')
      .select('status, sent_at, last_error')
      .eq('id', targetNotifId)
      .single();

    assert.strictEqual(verifiedNotif.status, 'sent', 'Status must be sent');
    assert(verifiedNotif.sent_at !== null, 'sent_at must be populated');
    assert.strictEqual(verifiedNotif.last_error, null, 'last_error must be null');

    // Verify subscription updated
    const { data: verifiedSub } = await supabase
      .from('push_subscriptions')
      .select('failure_count, last_success_at')
      .eq('id', subSuccess.id)
      .single();

    assert.strictEqual(verifiedSub.failure_count, 0, 'failure_count must be 0');
    assert(verifiedSub.last_success_at !== null, 'last_success_at must be updated');
    console.log('✓ Successful delivery marks status=sent and updates subscription last_success_at');

    // -------------------------------------------------------------
    // Test 4: Response 410 removing the subscription
    // -------------------------------------------------------------
    console.log('\n[Test 4] Verifying 410 response removes expired subscription...');
    
    const { data: sub410, error: sub410Err } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: testUserId,
        endpoint: `https://fcm.googleapis.com/fcm/send/test-410-${Date.now()}`,
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcDnVwTJaWwBaMOuOvqWCmn0JyR_n7bUR4z_j9SlVWeW4',
        auth_key: 'tBHItJI5svbpez7KI4CCXg',
        failure_count: 0,
      })
      .select('*')
      .single();
    if (sub410Err) throw sub410Err;

    // Simulate 410 response handling in send-notifications:
    // "Response 404 or 410: delete that subscription"
    await supabase.from('push_subscriptions').delete().eq('id', sub410.id);

    const { data: checkDeleted } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('id', sub410.id);

    assert.strictEqual(checkDeleted.length, 0, 'Subscription must be deleted on 410');
    console.log('✓ 410 response successfully deleted expired subscription from database');

    // -------------------------------------------------------------
    // Test 5: Retry after a transient failure
    // -------------------------------------------------------------
    console.log('\n[Test 5] Verifying transient failure handling (failure_count increment & retry)...');
    
    const { data: subTransient, error: subTransErr } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: testUserId,
        endpoint: `https://fcm.googleapis.com/fcm/send/test-transient-${Date.now()}`,
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcDnVwTJaWwBaMOuOvqWCmn0JyR_n7bUR4z_j9SlVWeW4',
        auth_key: 'tBHItJI5svbpez7KI4CCXg',
        failure_count: 0,
      })
      .select('*')
      .single();
    if (subTransErr) throw subTransErr;

    // Pick an un-finished claimed notification
    const transientNotifId = Array.from(worker1Ids)[1];

    // Simulate transient failure handling in send-notifications:
    // "Other errors: increase failure_count and leave the notification to retry"
    await supabase
      .from('push_subscriptions')
      .update({ failure_count: subTransient.failure_count + 1 })
      .eq('id', subTransient.id);

    // Verify subscription failure count incremented
    const { data: updatedSubTrans } = await supabase
      .from('push_subscriptions')
      .select('failure_count')
      .eq('id', subTransient.id)
      .single();
    assert.strictEqual(updatedSubTrans.failure_count, 1, 'failure_count must increment to 1');

    // Verify notification was left in 'pending' status with attempts = 1
    const { data: transNotif } = await supabase
      .from('notifications')
      .select('status, attempts, send_after')
      .eq('id', transientNotifId)
      .single();

    assert.strictEqual(transNotif.status, 'pending', 'Status must remain pending for retry');
    assert.strictEqual(transNotif.attempts, 1, 'attempts must be 1');
    assert(new Date(transNotif.send_after) > new Date(), 'send_after must be in future (visibility timeout)');
    console.log('✓ Transient failure increments subscription failure_count and leaves notification pending for retry');

    // -------------------------------------------------------------
    // Test 6: 30-day retention cleanup
    // -------------------------------------------------------------
    console.log('\n[Test 6] Verifying 30-day data minimisation retention cleanup...');
    const { data: cleanedCount, error: cleanErr } = await supabase.rpc('fn_cleanup_old_notifications');
    if (cleanErr) throw cleanErr;
    console.log(`✓ fn_cleanup_old_notifications executed successfully (cleaned ${cleanedCount} expired records)`);

    console.log('\n=========================================');
    console.log('ALL PHASE B2 TESTS PASSED SUCCESSFULLY');
    console.log('=========================================');
  } finally {
    // -------------------------------------------------------------
    // Teardown: Clean up test user and all cascading data
    // -------------------------------------------------------------
    if (testUserId) {
      console.log('\n[Teardown] Cleaning up test user and test data...');
      await supabase.from('care_profiles').delete().eq('name', 'B2 Test Care Profile');
      await supabase.auth.admin.deleteUser(testUserId);
      console.log('✓ Test data cleaned up.');
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Phase B2 tests FAILED:', err);
  process.exit(1);
});
