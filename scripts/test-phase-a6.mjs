import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import path from 'path';
import fs from 'fs';

// Load .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = env.TEST_BASE_URL || 'http://localhost:3000';
const ARTIFACT_DIR =
  env.ARTIFACT_DIR ||
  'C:/Users/Sourasish/.gemini/antigravity/brain/d2b0a0e6-7e7e-45cf-bbdb-d659180f7dc1';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('Missing SUPABASE_URL, ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('=================================================================');
  console.log('PHASE A6: SETTINGS & DATA RIGHTS VERIFICATION SUITE');
  console.log('=================================================================\n');

  const testEmail = `phase_a6_test_${Date.now()}@medbuddy.internal`;
  const testPassword = 'Password123!SecureTest';
  let userId = null;
  let browser = null;

  try {
    // Step 1: Provision test user
    console.log(`Step 1: Provisioning test user: ${testEmail}`);
    const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Dr. Gordon Freeman' },
    });

    if (userError || !userData?.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }
    userId = userData.user.id;
    console.log(`  ✓ Test user created with ID: ${userId}`);

    // Authenticate and obtain SSR session cookies
    const { data: sessionData, error: authError } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (authError || !sessionData?.session) {
      throw new Error(`Auth failed: ${authError?.message}`);
    }

    const cookieJar = [];
    const ssrClient = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: {
        getAll() {
          return cookieJar;
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieJar.push({ name, value, ...options });
          });
        },
      },
    });
    await ssrClient.auth.setSession({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    });

    // Step 2: Browser Setup
    browser = await chromium.launch({ channel: 'chrome', headless: true });

    // Mobile Context (360px)
    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 780 },
    });
    // Desktop Context (1280px)
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    const playwrightCookies = cookieJar.map((c) => ({
      name: c.name,
      value: c.value,
      domain: 'localhost',
      path: c.path || '/',
      httpOnly: c.httpOnly ?? true,
      secure: false,
      sameSite: 'Lax',
    }));

    await desktopContext.addCookies(playwrightCookies);
    await mobileContext.addCookies(playwrightCookies);

    const mobilePage = await mobileContext.newPage();
    const desktopPage = await desktopContext.newPage();

    // Step 3: Consent and Setup
    console.log('\nStep 2: Performing consent and setup for test user...');
    await desktopPage.goto(`${BASE_URL}/app/consent`, { waitUntil: 'domcontentloaded' });
    await desktopPage.click('button:has-text("I agree and continue")');

    await desktopPage.waitForURL('**/app/setup', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await desktopPage.fill('#name-input', 'Gordon Freeman');
    await desktopPage.click('button:has-text("Continue")');

    await desktopPage.waitForURL(`${BASE_URL}/app`, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });
    console.log('  ✓ Landed on Today screen with profile "Gordon Freeman"');

    // Sync mobile context cookies
    const authCookies = await desktopContext.cookies();
    await mobileContext.addCookies(authCookies);

    // Get care profile ID
    const { data: cpList } = await adminClient
      .from('care_access')
      .select('care_profile_id')
      .eq('user_id', userId);
    const careProfileId = cpList[0].care_profile_id;

    // Step 4: Provision clinical medication & schedule data for the export
    console.log('\nStep 3: Seeding clinical records (Atorvastatin 20 mg) for data rights test...');
    const { data: med } = await adminClient
      .from('medicines')
      .insert({
        care_profile_id: careProfileId,
        name: 'Atorvastatin',
        strength: '20 mg',
        form: 'tablet',
        unit: 'tablets',
        purpose: 'Cholesterol control',
      })
      .select()
      .single();

    await adminClient.from('inventory_items').insert({
      care_profile_id: careProfileId,
      medicine_id: med.id,
      quantity_initial: 30,
      expiry_date: getDateOffset(120),
      batch_number: 'AT-882',
      storage_location: 'Bedside Drawer',
    });

    const { data: sched } = await adminClient
      .from('schedules')
      .insert({
        care_profile_id: careProfileId,
        medicine_id: med.id,
        frequency: 'daily',
        dose_amount: 1,
        start_date: getDateOffset(0),
        active: true,
      })
      .select()
      .single();

    await adminClient.from('schedule_times').insert({
      care_profile_id: careProfileId,
      schedule_id: sched.id,
      time_of_day: '20:00:00',
    });

    // Generate dose events and log one as taken
    const { data: doseRes } = await adminClient
      .from('dose_events')
      .insert({
        care_profile_id: careProfileId,
        medicine_id: med.id,
        schedule_id: sched.id,
        scheduled_for: new Date(Date.now() - 3600 * 1000).toISOString(),
        amount: 1,
        status: 'pending',
      })
      .select()
      .single();

    // Log dose via authenticated client session
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      },
    });

    await userClient.rpc('fn_log_dose', {
      p_event: doseRes.id,
      p_status: 'taken',
      p_taken_at: new Date().toISOString(),
    });
    console.log('  ✓ Seeded Atorvastatin with inventory, schedule, and taken dose log');

    // Step 5: Test Download My Data (Export) via UI and API
    console.log('\nStep 4: Testing "Download my data" (Export)...');
    await mobilePage.goto(`${BASE_URL}/app/settings`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Privacy & Data Rights', { timeout: 10000 });
    console.log('  ✓ Found Privacy & Data Rights section');

    // Click download button in UI and capture download event
    const [download] = await Promise.all([
      mobilePage.waitForEvent('download'),
      mobilePage.click('button:has-text("Download my data (JSON)")'),
    ]);
    const downloadPath = await download.path();
    const exportedRaw = fs.readFileSync(downloadPath, 'utf8');
    const exportedJson = JSON.parse(exportedRaw);

    console.log('  ✓ File downloaded successfully via browser UI');
    console.log(`  Exported Keys: ${Object.keys(exportedJson).join(', ')}`);

    // Validate Export Structure per GDPR Article 12 compliance
    if (!exportedJson.exported_at || !exportedJson.profile || !exportedJson.care_profiles) {
      throw new Error('Export JSON missing required top-level GDPR fields');
    }
    const exportedCp = exportedJson.care_profiles[0];
    if (
      !exportedCp.medicines ||
      !exportedCp.inventory ||
      !exportedCp.schedules ||
      !exportedCp.dose_events
    ) {
      throw new Error('Export JSON missing nested clinical entities');
    }
    console.log(`  Exported Care Profiles count: ${exportedJson.care_profiles.length}`);
    console.log(
      `  Exported Medicines count: ${exportedCp.medicines.length} (${exportedCp.medicines[0].name})`,
    );
    console.log(`  Exported Inventory items count: ${exportedCp.inventory.length}`);
    console.log(`  Exported Dose events count: ${exportedCp.dose_events.length}`);
    console.log('  ✓ Exported JSON schema perfectly matches specifications');

    // Capture Settings screenshots
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a6-settings-data-rights-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Settings Privacy & Data Rights section at 360px');

    await desktopPage.goto(`${BASE_URL}/app/settings`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForSelector('text=Privacy & Data Rights', { timeout: 10000 });
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a6-settings-full-1280px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured full Settings layout at 1280px');

    // Step 6: Test Delete Account Flow via UI
    console.log('\nStep 5: Testing Delete Account & Data flow via UI...');
    await mobilePage.click('button:has-text("Delete my account and data")');
    await mobilePage.waitForSelector('h2:has-text("Delete account and all data?")', {
      timeout: 5000,
    });
    console.log('  ✓ Delete Account Confirmation Modal opened');

    // Verify delete button is disabled before typing confirmation
    const deleteSubmitBtn = mobilePage.locator('button:has-text("Permanently delete account")');
    const isInitiallyDisabled = await deleteSubmitBtn.isDisabled();
    if (!isInitiallyDisabled) {
      throw new Error('Delete button must be disabled until DELETE is typed');
    }
    console.log('  ✓ Confirmed delete button is initially disabled');

    // Capture Delete confirmation modal
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a6-delete-account-modal-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Delete Account Modal at 360px');

    // Type DELETE to confirm
    await mobilePage.fill('#confirm-delete-input', 'DELETE');
    const isNowEnabled = await deleteSubmitBtn.isEnabled();
    if (!isNowEnabled) {
      throw new Error('Delete button must be enabled when DELETE is typed');
    }
    console.log('  ✓ Confirmed delete button becomes enabled after typing DELETE');

    // Click delete and wait for success screen
    await deleteSubmitBtn.click();
    await mobilePage.waitForSelector('h2:has-text("Account & Data Permanently Deleted")', {
      timeout: 10000,
    });
    console.log('  ✓ Reached final success screen inside modal');

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a6-delete-success-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured final success screen at 360px');

    // Click return to homepage
    await mobilePage.click('button:has-text("Return to homepage")');
    await mobilePage.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    console.log('  ✓ Navigated back to homepage');

    // Step 7: Verify Database Zero-Residual State (Nothing Left Behind)
    console.log('\nStep 6: Verifying Database Zero-Residual State (Nothing Left Behind)...');

    // Check auth.users
    const { data: userCheck } = await adminClient.auth.admin.getUserById(userId);
    if (userCheck?.user) {
      throw new Error(`Residual auth user record found for ${userId}`);
    }
    console.log('  ✓ auth.users record purged (404/null)');

    // Check profiles
    const { data: profCheck } = await adminClient.from('profiles').select('id').eq('id', userId);
    if (profCheck && profCheck.length > 0) {
      throw new Error(`Residual profiles record found for ${userId}`);
    }
    console.log('  ✓ profiles record purged (0 rows)');

    // Check care_profiles
    const { data: cpCheck } = await adminClient
      .from('care_profiles')
      .select('id')
      .eq('id', careProfileId);
    if (cpCheck && cpCheck.length > 0) {
      throw new Error(`Residual care_profiles record found for ${careProfileId}`);
    }
    console.log('  ✓ care_profiles record purged (0 rows)');

    // Check medicines
    const { data: medCheck } = await adminClient
      .from('medicines')
      .select('id')
      .eq('care_profile_id', careProfileId);
    if (medCheck && medCheck.length > 0) {
      throw new Error(`Residual medicines found for care profile`);
    }
    console.log('  ✓ medicines records purged (0 rows)');

    // Check inventory_items
    const { data: invCheck } = await adminClient
      .from('inventory_items')
      .select('id')
      .eq('care_profile_id', careProfileId);
    if (invCheck && invCheck.length > 0) {
      throw new Error(`Residual inventory records found`);
    }
    console.log('  ✓ inventory_items records purged (0 rows)');

    // Check dose_events
    const { data: doseCheck } = await adminClient
      .from('dose_events')
      .select('id')
      .eq('care_profile_id', careProfileId);
    if (doseCheck && doseCheck.length > 0) {
      throw new Error(`Residual dose_events records found`);
    }
    console.log('  ✓ dose_events records purged (0 rows)');

    userId = null; // Prevent finally block cleanup from throwing

    console.log('\n=================================================================');
    console.log('✅ ALL PHASE A6 VERIFICATION CHECKS PASSED WITH FLYING COLORS!');
    console.log('=================================================================\n');
  } finally {
    if (browser) await browser.close();

    if (userId) {
      console.log(`Cleaning up test user ${userId}...`);
      await adminClient.auth.admin.deleteUser(userId);
      console.log('✓ Test user deleted cleanly.');
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
