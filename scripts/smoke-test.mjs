import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

// ---------------------------------------------------------------------
// 1. Safety Gate: Development Project Check
// ---------------------------------------------------------------------
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

if (process.env.ALLOW_TEST_USERS !== 'true') {
  console.error('\n❌ ERROR: Smoke tests refused to run.');
  console.error('Smoke tests create and delete real test users. Set ALLOW_TEST_USERS=true in .env.local to run on development.');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('Missing required Supabase environment variables in .env.local');
  process.exit(1);
}

console.log('=================================================================');
console.log('MEDBUDDY BACKEND SMOKE TEST: REAL STACK SECURITY VERIFICATION');
console.log(`Target: ${supabaseUrl}`);
console.log('=================================================================\n');

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const makeClient = () =>
  createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const anonClient = makeClient();
const clientA = makeClient();
const clientB = makeClient();

async function main() {
  const stamp = Date.now();
  const userA_email = `smoke-a-${stamp}@medbuddy.test`;
  const userB_email = `smoke-b-${stamp}@medbuddy.test`;
  const testPassword = `MedBuddySmoke!${stamp}`;

  let userA_id = null;
  let userB_id = null;
  let careProfileId = null;

  try {
    // -----------------------------------------------------------------
    // SETUP: Create two test users and obtain real signed-in JWTs
    // -----------------------------------------------------------------
    console.log('[Setup] Creating Test User A and Test User B via Admin API...');
    const { data: userAData, error: userAErr } = await adminClient.auth.admin.createUser({
      email: userA_email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Smoke User A' },
    });
    if (userAErr) throw userAErr;
    userA_id = userAData.user.id;

    const { data: userBData, error: userBErr } = await adminClient.auth.admin.createUser({
      email: userB_email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Smoke User B' },
    });
    if (userBErr) throw userBErr;
    userB_id = userBData.user.id;

    console.log(`  User A: ${userA_id}`);
    console.log(`  User B: ${userB_id}`);

    // Wait briefly for triggers
    await new Promise((r) => setTimeout(r, 600));

    // Sign in User A to get real user JWT on clientA
    const { error: signAErr } = await clientA.auth.signInWithPassword({
      email: userA_email,
      password: testPassword,
    });
    if (signAErr) throw signAErr;

    // Sign in User B to get real user JWT on clientB
    const { error: signBErr } = await clientB.auth.signInWithPassword({
      email: userB_email,
      password: testPassword,
    });
    if (signBErr) throw signBErr;

    console.log('✓ Both users signed in with valid client JWTs.\n');

    // -----------------------------------------------------------------
    // CHECK 1: Anonymous Access Refusal (anon key & no login)
    // -----------------------------------------------------------------
    console.log('[Check 1] Anonymous Access Refusal: RLS and RPC lockdown...');
    const tables = [
      'profiles',
      'care_profiles',
      'care_access',
      'medicines',
      'inventory_items',
      'schedules',
      'schedule_times',
      'dose_events',
      'stock_movements',
      'notifications',
      'push_subscriptions',
      'consents',
      'access_events',
      'invites',
    ];

    for (const table of tables) {
      const { data, error } = await anonClient.from(table).select('*').limit(5);
      // Either error or empty array due to RLS
      const isRefused = error !== null || (Array.isArray(data) && data.length === 0);
      assert(isRefused, `Anon read on ${table} must be refused or return empty`);
    }
    console.log(`  ✓ All ${tables.length} tables return empty/refused for anon role.`);

    // Check RPCs refused for anon
    const { error: anonRpc1 } = await anonClient.rpc('fn_create_care_profile', { p_name: 'Hacked' });
    assert(anonRpc1 !== null, 'Anon cannot call fn_create_care_profile');

    const { error: anonRpc2 } = await anonClient.rpc('fn_export_my_data');
    assert(anonRpc2 !== null, 'Anon cannot call fn_export_my_data');
    console.log('  ✓ RPC execution refused for unauthenticated callers.');
    console.log('✓ Check 1 PASSED: Anonymous access is completely blocked.\n');

    // -----------------------------------------------------------------
    // CHECK 2: User A valid workflow (Create, Schedule, Log, FEFO, Undo)
    // -----------------------------------------------------------------
    console.log('[Check 2] User A Valid Workflow (Care profile, Meds, Box, Schedule, Log, Undo)...');
    
    // 1. A creates care profile
    const { data: cpId, error: cpErr } = await clientA.rpc('fn_create_care_profile', {
      p_name: 'Asha (Mum)',
    });
    if (cpErr) throw cpErr;
    careProfileId = cpId;
    assert(careProfileId, 'Care profile ID must be returned');

    // 2. A creates a medicine
    const { data: medData, error: medErr } = await clientA
      .from('medicines')
      .insert({
        care_profile_id: careProfileId,
        name: 'Metformin',
        strength: '500 mg',
        unit: 'tablet',
      })
      .select('id')
      .single();
    if (medErr) throw medErr;
    const medicineId = medData.id;

    // 3. A creates two boxes: Box A (expires in 60d, 10 units), Box B (expires in 20d, 10 units)
    const today = new Date();
    const expiry60 = new Date(today.getTime() + 60 * 86400000).toISOString().split('T')[0];
    const expiry20 = new Date(today.getTime() + 20 * 86400000).toISOString().split('T')[0];

    const { data: boxA } = await clientA
      .from('inventory_items')
      .insert({
        medicine_id: medicineId,
        care_profile_id: careProfileId,
        quantity_initial: 10,
        expiry_date: expiry60,
      })
      .select('id, quantity_remaining')
      .single();

    const { data: boxB } = await clientA
      .from('inventory_items')
      .insert({
        medicine_id: medicineId,
        care_profile_id: careProfileId,
        quantity_initial: 10,
        expiry_date: expiry20,
      })
      .select('id, quantity_remaining')
      .single();

    assert.strictEqual(boxA.quantity_remaining, 10);
    assert.strictEqual(boxB.quantity_remaining, 10);

    // 4. A creates daily schedule
    const todayDate = today.toISOString().split('T')[0];
    const { data: schData } = await clientA
      .from('schedules')
      .insert({
        medicine_id: medicineId,
        care_profile_id: careProfileId,
        frequency: 'daily',
        start_date: todayDate,
        dose_amount: 1,
      })
      .select('id')
      .single();

    await clientA.from('schedule_times').insert([
      { schedule_id: schData.id, care_profile_id: careProfileId, time_of_day: '08:00' },
      { schedule_id: schData.id, care_profile_id: careProfileId, time_of_day: '20:00' },
    ]);

    // Resync schedule to generate doses
    await clientA.rpc('fn_resync_schedule', { p_schedule: schData.id });

    // 5. Query generated dose event
    const { data: dose } = await clientA
      .from('dose_events')
      .select('id, status')
      .eq('care_profile_id', careProfileId)
      .order('scheduled_for')
      .limit(1)
      .single();
    assert(dose, 'Dose event must be generated');
    assert.strictEqual(dose.status, 'pending');

    // 6. Log dose taken
    const { data: logRes, error: logErr } = await clientA.rpc('fn_log_dose', {
      p_event: dose.id,
      p_status: 'taken',
    });
    if (logErr) throw logErr;

    // Verify FEFO: Box B (earliest expiry, 20d) must be deducted to 9, Box A (60d) remains 10
    const { data: checkB1 } = await clientA.from('inventory_items').select('quantity_remaining').eq('id', boxB.id).single();
    const { data: checkA1 } = await clientA.from('inventory_items').select('quantity_remaining').eq('id', boxA.id).single();
    assert.strictEqual(checkB1.quantity_remaining, 9, 'FEFO: Earliest-expiring box deducted first');
    assert.strictEqual(checkA1.quantity_remaining, 10, 'Later box untouched');

    // 7. Undo dose
    const { error: undoErr } = await clientA.rpc('fn_undo_dose', { p_event: dose.id });
    if (undoErr) throw undoErr;

    // Verify stock restored
    const { data: checkB2 } = await clientA.from('inventory_items').select('quantity_remaining').eq('id', boxB.id).single();
    assert.strictEqual(checkB2.quantity_remaining, 10, 'Undo restores stock exactly to 10');
    console.log('✓ Check 2 PASSED: User A workflow, FEFO deduction, and exact undo verified.\n');

    // -----------------------------------------------------------------
    // CHECK 3: User B (Stranger) Data Isolation
    // -----------------------------------------------------------------
    console.log('[Check 3] User B (Stranger) Isolation: Zero Visibility & Write Refusal...');
    
    // B queries care profiles, medicines, inventory, doses
    const { data: bProfiles } = await clientB.from('care_profiles').select('*');
    assert.strictEqual(bProfiles.length, 0, 'Stranger must see 0 care profiles');

    const { data: bMeds } = await clientB.from('medicines').select('*');
    assert.strictEqual(bMeds.length, 0, 'Stranger must see 0 medicines');

    const { data: bBoxes } = await clientB.from('inventory_items').select('*');
    assert.strictEqual(bBoxes.length, 0, 'Stranger must see 0 boxes');

    const { data: bDoses } = await clientB.from('dose_events').select('*');
    assert.strictEqual(bDoses.length, 0, 'Stranger must see 0 doses');

    // B attempts to write to A's care profile
    const { error: bWriteMed } = await clientB.from('medicines').insert({
      care_profile_id: careProfileId,
      name: 'Unauthorized Drug',
      unit: 'tablet',
    });
    assert(bWriteMed !== null, 'Stranger insert into medicines must be refused');

    // B attempts to call fn_log_dose on A's dose
    const { error: bLogDose } = await clientB.rpc('fn_log_dose', {
      p_event: dose.id,
      p_status: 'taken',
    });
    assert(bLogDose !== null, 'Stranger call to fn_log_dose must be refused');
    console.log('✓ Check 3 PASSED: Stranger sees none of User A data and all writes are refused.\n');

    // -----------------------------------------------------------------
    // CHECK 4: Tamper Protection (Direct Column & Table Bypass Refusal)
    // -----------------------------------------------------------------
    console.log('[Check 4] Tamper Protection: Direct bypasses and private RPCs blocked...');
    
    // Direct update of quantity_remaining (must be refused or not touch column)
    const { data: directUpd, error: directUpdErr } = await clientA
      .from('inventory_items')
      .update({ quantity_remaining: 999 })
      .eq('id', boxA.id)
      .select('quantity_remaining');
    // Schema revokes update on quantity_remaining
    const { data: boxACheck } = await clientA.from('inventory_items').select('quantity_remaining').eq('id', boxA.id).single();
    assert.strictEqual(boxACheck.quantity_remaining, 10, 'Direct edit of quantity_remaining is blocked');

    // Direct insert into dose_events
    const { error: dirDoseErr } = await clientA.from('dose_events').insert({
      care_profile_id: careProfileId,
      medicine_id: medicineId,
      scheduled_for: new Date().toISOString(),
      dose_amount: 1,
    });
    assert(dirDoseErr !== null, 'Direct insert into dose_events must be refused');

    // Direct insert into stock_movements
    const { error: dirStockErr } = await clientA.from('stock_movements').insert({
      inventory_item_id: boxA.id,
      quantity_change: -5,
      movement_type: 'dose_taken',
    });
    assert(dirStockErr !== null, 'Direct insert into stock_movements must be refused');

    // Direct insert into care_access
    const { error: dirAccessErr } = await clientA.from('care_access').insert({
      care_profile_id: careProfileId,
      user_id: userB_id,
      role: 'owner',
    });
    assert(dirAccessErr !== null, 'Direct insert into care_access must be refused');

    // Private backend functions called by authenticated user
    const { error: priv1 } = await clientA.rpc('fn_generate_dose_events', { p_days_ahead: 7 });
    assert(priv1 !== null, 'fn_generate_dose_events must be refused for client');

    const { error: priv2 } = await clientA.rpc('fn_enqueue_due_notifications');
    assert(priv2 !== null, 'fn_enqueue_due_notifications must be refused for client');

    const { error: priv3 } = await clientA.rpc('fn_enqueue_expiry_notifications');
    assert(priv3 !== null, 'fn_enqueue_expiry_notifications must be refused for client');

    const { error: priv4 } = await clientA.rpc('fn_claim_notifications', { p_limit: 10 });
    assert(priv4 !== null, 'fn_claim_notifications must be refused for client');

    const { error: priv5 } = await clientA.rpc('_deduct_stock', {
      p_medicine: medicineId,
      p_amount: 1,
      p_event: dose.id,
    });
    assert(priv5 !== null, '_deduct_stock must be refused for client');
    console.log('✓ Check 4 PASSED: Tamper attempts and private scheduler RPCs are strictly refused.\n');

    // -----------------------------------------------------------------
    // CHECK 5: Invite Flow (Family Sharing, Viewer Read-Only, Removal)
    // -----------------------------------------------------------------
    console.log('[Check 5] Invite Flow: Invite creation, acceptance, viewer read-only, removal...');
    
    // 1. A creates invite for B as viewer
    const { data: inviteToken, error: invErr } = await clientA.rpc('fn_create_invite', {
      p_care_profile: careProfileId,
      p_role: 'viewer',
    });
    if (invErr) throw invErr;
    assert(inviteToken, 'Invite token must be returned');

    // 2. B accepts invite
    const { data: acceptedCpId, error: accErr } = await clientB.rpc('fn_accept_invite', {
      p_token: inviteToken,
    });
    if (accErr) throw accErr;
    assert.strictEqual(acceptedCpId, careProfileId, 'Accepted care profile ID must match');

    // 3. B can now read care profile and medicines
    const { data: bReadCp } = await clientB.from('care_profiles').select('*').eq('id', careProfileId);
    assert.strictEqual(bReadCp.length, 1, 'B can now view care profile');

    const { data: bReadMeds } = await clientB.from('medicines').select('*').eq('care_profile_id', careProfileId);
    assert.strictEqual(bReadMeds.length, 1, 'B can now view medicines');

    // 4. B (viewer) attempts to write -> must be refused
    const { error: bViewerWrite } = await clientB.from('medicines').insert({
      care_profile_id: careProfileId,
      name: 'Viewer Injected Medicine',
      unit: 'tablet',
    });
    assert(bViewerWrite !== null, 'Viewer cannot insert medicines');

    const { error: bViewerLog } = await clientB.rpc('fn_log_dose', {
      p_event: dose.id,
      p_status: 'taken',
    });
    assert(bViewerLog !== null, 'Viewer cannot log doses');

    // 5. A removes B
    const { error: remErr } = await clientA.rpc('fn_remove_access', {
      p_care_profile: careProfileId,
      p_user: userB_id,
    });
    if (remErr) throw remErr;

    // Verify B no longer sees care profile
    const { data: bRevoked } = await clientB.from('care_profiles').select('*').eq('id', careProfileId);
    assert.strictEqual(bRevoked.length, 0, 'Revoked user sees 0 care profiles');
    console.log('✓ Check 5 PASSED: Family sharing invite, viewer read-only, and removal verified.\n');

    // -----------------------------------------------------------------
    // CHECK 6: Data Export & Clean Deletion (GDPR / DPDP compliance)
    // -----------------------------------------------------------------
    console.log('[Check 6] Data Export and Data Deletion (fn_export_my_data & fn_delete_my_data)...');
    
    const { data: exportData, error: expErr } = await clientA.rpc('fn_export_my_data');
    if (expErr) throw expErr;
    assert(exportData.profile, 'Export must include profile');
    assert(Array.isArray(exportData.care_profiles), 'Export must include care profiles');
    assert.strictEqual(exportData.care_profiles.length, 1, 'Export contains 1 care profile');
    assert.strictEqual(exportData.care_profiles[0].medicines.length, 1, 'Export contains 1 medicine');
    console.log('  ✓ fn_export_my_data returned complete structured JSON data.');

    // Delete my data
    const { error: delErr } = await clientA.rpc('fn_delete_my_data');
    if (delErr) throw delErr;

    // Verify nothing is left behind
    const { data: cpCheck } = await adminClient.from('care_profiles').select('*').eq('id', careProfileId);
    assert.strictEqual(cpCheck.length, 0, 'Care profile deleted');

    const { data: medCheck } = await adminClient.from('medicines').select('*').eq('care_profile_id', careProfileId);
    assert.strictEqual(medCheck.length, 0, 'Medicines deleted');

    const { data: itemCheck } = await adminClient.from('inventory_items').select('*').eq('care_profile_id', careProfileId);
    assert.strictEqual(itemCheck.length, 0, 'Inventory items deleted');

    const { data: userACheck } = await adminClient.from('profiles').select('*').eq('id', userA_id);
    assert.strictEqual(userACheck.length, 0, 'Profile row deleted');

    console.log('  ✓ All care profiles, medicines, inventory, and profile records deleted.');
    console.log('✓ Check 6 PASSED: Data export and clean account deletion verified.\n');

    console.log('=================================================================');
    console.log('ALL PHASE B4 SMOKE TESTS PASSED CLEANLY ON THE REAL SUPABASE STACK');
    console.log('=================================================================');
  } finally {
    // -----------------------------------------------------------------
    // TEARDOWN: Guarantee test users and data are deleted even on failure
    // -----------------------------------------------------------------
    console.log('\n[Teardown] Cleaning up test users and safety records...');
    if (careProfileId) {
      await adminClient.from('care_profiles').delete().eq('id', careProfileId);
    }
    if (userA_id) {
      await adminClient.auth.admin.deleteUser(userA_id);
    }
    if (userB_id) {
      await adminClient.auth.admin.deleteUser(userB_id);
    }
    console.log('✓ Teardown complete.');
  }
}

main().catch((err) => {
  console.error('\n❌ Smoke Test FAILED:', err);
  process.exit(1);
});
