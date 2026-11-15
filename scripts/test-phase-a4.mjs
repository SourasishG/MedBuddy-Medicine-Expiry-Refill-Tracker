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
  console.log('PHASE A4: SCHEDULES & TODAY SCREEN VERIFICATION SUITE');
  console.log('=================================================================\n');

  const testEmail = `phase_a4_test_${Date.now()}@medbuddy.internal`;
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
      user_metadata: { full_name: 'Dr. Aria Chen' },
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

    // Mobile Viewport (360px)
    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 780 },
    });
    // Desktop Viewport (1280px)
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
    await desktopPage.fill('#name-input', 'Aria Chen');
    await desktopPage.click('button:has-text("Continue")');

    await desktopPage.waitForURL(`${BASE_URL}/app`, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });
    console.log('  ✓ Landed on Today screen with profile "Aria Chen"');

    // Sync mobile context cookies
    const authCookies = await desktopContext.cookies();
    await mobileContext.addCookies(authCookies);

    // Get care profile ID
    const { data: cpList } = await adminClient
      .from('care_access')
      .select('care_profile_id')
      .eq('user_id', userId);
    const careProfileId = cpList[0].care_profile_id;

    // Step 4: Test Add Medicine Flow with Schedule via UI
    console.log('\nStep 3: Testing Add Medicine Flow with Schedule (Lisinopril 10 mg)...');
    await mobilePage.goto(`${BASE_URL}/app/medicine/add`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Add a medicine', { timeout: 10000 });

    // Step 1: Info
    await mobilePage.fill('#med-name', 'Lisinopril');
    await mobilePage.fill('#med-strength', '10 mg');
    await mobilePage.fill('#med-purpose', 'Blood pressure management');
    await mobilePage.click('button:has-text("Next: First box details")');

    // Step 2: First Box Details
    await mobilePage.waitForSelector('text=First box details', { timeout: 5000 });
    await mobilePage.fill('#box-qty', '30');
    await mobilePage.fill('#box-expiry', getDateOffset(90));
    await mobilePage.fill('#box-location', 'Kitchen Shelf');
    await mobilePage.fill('#box-batch', 'LP-881');
    await mobilePage.click('button:has-text("Next: Set schedule")');

    // Step 3: Schedule Details
    await mobilePage.waitForSelector('text=Set a schedule', { timeout: 5000 });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-add-medicine-step3-schedule-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Add Medicine Step 3 (Schedule) screen at 360px');

    // Fill instructions
    await mobilePage.fill('#sched-instructions', 'Take with a glass of morning water');
    await mobilePage.click('button:has-text("Save medicine")');

    await mobilePage.waitForURL(
      (url) => url.pathname.startsWith('/app/medicine/') && url.pathname !== '/app/medicine/add',
      { timeout: 15000, waitUntil: 'domcontentloaded' },
    );
    console.log(`  ✓ Successfully saved Lisinopril with schedule! Now at: ${mobilePage.url()}`);

    // Verify Medicine Detail displays Schedule section
    await mobilePage.waitForSelector('text=Schedule & Reminders', { timeout: 5000 });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-medicine-detail-schedule-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Medicine Detail Schedule section at 360px');

    // Get Lisinopril medicine ID
    const { data: lisMed } = await adminClient
      .from('medicines')
      .select('id')
      .eq('care_profile_id', careProfileId)
      .eq('name', 'Lisinopril')
      .single();
    const lisinoprilId = lisMed.id;

    // Step 5: Provision specific clinical dose scenarios for Today testing
    console.log('\nStep 4: Provisioning specific clinical dose scenarios...');

    const now = new Date();
    // A. Due now dose (15 mins ago)
    const dueTime = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    await adminClient.from('dose_events').insert({
      care_profile_id: careProfileId,
      medicine_id: lisinoprilId,
      scheduled_for: dueTime,
      amount: 1,
      status: 'pending',
    });

    // B. Later today dose (in 4 hours)
    const laterTime = new Date(now.getTime() + 4 * 3600 * 1000).toISOString();
    await adminClient.from('dose_events').insert({
      care_profile_id: careProfileId,
      medicine_id: lisinoprilId,
      scheduled_for: laterTime,
      amount: 1,
      status: 'pending',
    });

    // C. Missed dose (3 hours ago -> 180 mins > 120 mins threshold)
    const missedTime = new Date(now.getTime() - 3 * 3600 * 1000).toISOString();
    await adminClient.from('dose_events').insert({
      care_profile_id: careProfileId,
      medicine_id: lisinoprilId,
      scheduled_for: missedTime,
      amount: 1,
      status: 'pending',
    });

    // D. As-needed medicine: Paracetamol 500 mg with 10 tablets stock
    const { data: prnMed } = await adminClient
      .from('medicines')
      .insert({
        care_profile_id: careProfileId,
        name: 'Paracetamol',
        strength: '500 mg',
        form: 'tablet',
        unit: 'tablets',
        purpose: 'Headache or mild fever',
      })
      .select('id')
      .single();

    await adminClient.from('schedules').insert({
      care_profile_id: careProfileId,
      medicine_id: prnMed.id,
      frequency: 'as_needed',
      start_date: getDateOffset(0),
      dose_amount: 1,
      active: true,
    });

    await adminClient.from('inventory_items').insert({
      medicine_id: prnMed.id,
      care_profile_id: careProfileId,
      quantity_initial: 10,
      expiry_date: getDateOffset(180),
      storage_location: 'Bedside Table',
    });

    // E. Zero stock medicine for shortfall test: Insulin Glargine
    const { data: zeroMed } = await adminClient
      .from('medicines')
      .insert({
        care_profile_id: careProfileId,
        name: 'Insulin Glargine',
        strength: '100 units/ml',
        form: 'injection',
        unit: 'units',
        purpose: 'Basal glycemic control',
      })
      .select('id')
      .single();

    // Box with 0 remaining
    await adminClient.from('inventory_items').insert({
      medicine_id: zeroMed.id,
      care_profile_id: careProfileId,
      quantity_initial: 0,
      expiry_date: getDateOffset(60),
    });

    const shortfallDueTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    await adminClient.from('dose_events').insert({
      care_profile_id: careProfileId,
      medicine_id: zeroMed.id,
      scheduled_for: shortfallDueTime,
      amount: 10,
      status: 'pending',
    });

    console.log('  ✓ Successfully provisioned all clinical dose scenarios!');

    // Step 6: Verify Today Screen sections at 360px and 1280px
    console.log('\nStep 5: Verifying Today screen sections and responsive layouts...');
    await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Due now', { timeout: 10000 });
    await mobilePage.waitForSelector('text=Later today', { timeout: 5000 });
    await mobilePage.waitForSelector('text=Missed', { timeout: 5000 });
    await mobilePage.waitForSelector('text=As needed', { timeout: 5000 });

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-today-due-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today screen with Due now at 360px');

    // Desktop capture
    await desktopPage.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForSelector('text=Due now', { timeout: 10000 });
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-today-full-1280px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today screen at 1280px');

    // Step 7: Test Taking a Dose & Stock Decrement
    console.log('\nStep 6: Testing Taken action and stock deduction...');
    // Initial stock check
    const { data: boxBefore } = await adminClient
      .from('inventory_items')
      .select('quantity_remaining')
      .eq('medicine_id', lisinoprilId)
      .single();
    const initialQty = Number(boxBefore.quantity_remaining);
    console.log(`  Initial Lisinopril stock: ${initialQty}`);

    // Click "Taken" on Due now Lisinopril dose
    const dueCard = mobilePage.locator('article[data-status="due"]:has-text("Lisinopril")').first();
    await dueCard.locator('button:has-text("Taken")').click();
    await mobilePage.waitForTimeout(1000);

    // Verify it moved to Done today
    await mobilePage.waitForSelector(
      'section:has-text("Done today") >> article:has-text("Lisinopril")',
      {
        timeout: 5000,
      },
    );
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-today-taken-done-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today Taken -> Done today at 360px');

    // Verify stock decreased by 1
    const { data: boxAfterTake } = await adminClient
      .from('inventory_items')
      .select('quantity_remaining')
      .eq('medicine_id', lisinoprilId)
      .single();
    const qtyAfterTake = Number(boxAfterTake.quantity_remaining);
    console.log(`  Stock after taking dose: ${qtyAfterTake} (expected: ${initialQty - 1})`);
    if (qtyAfterTake !== initialQty - 1) {
      throw new Error(`Expected stock to decrease to ${initialQty - 1}, but got ${qtyAfterTake}`);
    }

    // Step 8: Test Undo Dose & Stock Restoration
    console.log('\nStep 7: Testing Undo action and stock restoration...');
    const doneLisinopril = mobilePage
      .locator('section:has-text("Done today") >> article:has-text("Lisinopril")')
      .first();
    await doneLisinopril.locator('button:has-text("Undo")').click();
    await mobilePage.waitForTimeout(1000);

    // Verify it moved back to Due now
    await mobilePage.waitForSelector('article[data-status="due"]:has-text("Lisinopril")', {
      timeout: 5000,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-today-undo-restored-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today Undo -> Restored to Due now at 360px');

    // Verify stock restored back to initialQty
    const { data: boxAfterUndo } = await adminClient
      .from('inventory_items')
      .select('quantity_remaining')
      .eq('medicine_id', lisinoprilId)
      .single();
    const qtyAfterUndo = Number(boxAfterUndo.quantity_remaining);
    console.log(`  Stock after undo: ${qtyAfterUndo} (expected: ${initialQty})`);
    if (qtyAfterUndo !== initialQty) {
      throw new Error(`Expected stock to restore to ${initialQty}, but got ${qtyAfterUndo}`);
    }

    // Step 9: Test Snooze Action
    console.log('\nStep 8: Testing Snooze action...');
    const dueCardToSnooze = mobilePage
      .locator('article[data-status="due"]:has-text("Lisinopril")')
      .first();
    await dueCardToSnooze.locator('button:has-text("Snooze")').click();
    await mobilePage.waitForTimeout(1000);

    // Verify it moved to Later today with Snooze badge
    await mobilePage.waitForSelector('text=Snoozed until', { timeout: 5000 });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-today-snoozed-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today Snoozed -> Later today at 360px');

    // Step 10: Test Skip Action
    console.log('\nStep 9: Testing Skip action...');
    const snoozedCard = mobilePage
      .locator('section:has-text("Later today") article:has-text("Lisinopril")')
      .first();
    await snoozedCard.locator('button:has-text("Skip")').click();
    await mobilePage.waitForTimeout(1000);

    // Verify it moved to Done today as Skipped
    await mobilePage.waitForSelector('section:has-text("Done today") >> text=Skipped', {
      timeout: 5000,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-today-skipped-done-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today Skipped -> Done today at 360px');

    // Step 11: Verify Missed Section
    console.log('\nStep 10: Verifying Missed section...');
    await mobilePage.waitForSelector('section:has-text("Missed")', { timeout: 5000 });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-today-missed-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today Missed section at 360px');

    // Step 12: Test As-Needed (PRN) Dose Logging
    console.log('\nStep 11: Testing As-needed dose logging (Paracetamol)...');
    const prnCard = mobilePage.locator('div[class*="asNeededCard"]:has-text("Paracetamol")');
    await prnCard.locator('button:has-text("Log a dose")').click();
    await mobilePage.waitForSelector('text=Log Paracetamol', { timeout: 5000 });
    await mobilePage.fill('#prn-amount-input', '2');
    await mobilePage.click('button[type="submit"]:has-text("Log dose")');
    await mobilePage.waitForTimeout(1000);

    // Verify Paracetamol in Done today
    await mobilePage.waitForSelector(
      'section:has-text("Done today") >> article:has-text("Paracetamol")',
      { timeout: 5000 },
    );
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-today-as-needed-logged-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today As-needed dose logged at 360px');

    // Check Paracetamol stock decreased from 10 to 8
    const { data: prnBox } = await adminClient
      .from('inventory_items')
      .select('quantity_remaining')
      .eq('medicine_id', prnMed.id)
      .single();
    console.log(`  Paracetamol stock after taking 2: ${prnBox.quantity_remaining} (expected: 8)`);
    if (Number(prnBox.quantity_remaining) !== 8) {
      throw new Error(`Expected Paracetamol stock to be 8, got ${prnBox.quantity_remaining}`);
    }

    // Step 13: Test Stock Shortfall Note
    console.log('\nStep 12: Testing Stock Shortfall Note (Insulin Glargine)...');
    const insulinCard = mobilePage
      .locator('article[data-status="due"]:has-text("Insulin Glargine")')
      .first();
    await insulinCard.locator('button:has-text("Taken")').click();
    await mobilePage.waitForTimeout(1000);

    await mobilePage.waitForSelector('text=Logged. You may be out of this medicine.', {
      timeout: 5000,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a4-today-shortfall-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today Stock Shortfall Note at 360px');

    console.log('\n=================================================================');
    console.log('✅ ALL PHASE A4 VERIFICATION CHECKS PASSED WITH FLYING COLORS!');
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
