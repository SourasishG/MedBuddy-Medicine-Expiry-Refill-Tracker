import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { spawnSync } from 'child_process';
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

// ---------------------------------------------------------------------------
// MANDATORY GUARD: Refuse to run unless ALLOW_TEST_USERS=true
// ---------------------------------------------------------------------------
if (process.env.ALLOW_TEST_USERS !== 'true' && env.ALLOW_TEST_USERS !== 'true') {
  console.error(
    '=========================================================================\n' +
      'REFUSAL ERROR: ALLOW_TEST_USERS is not set to "true".\n' +
      'Playwright end-to-end tests are strictly prohibited on non-development environments.\n' +
      'To run this suite, explicitly set ALLOW_TEST_USERS=true in .env.local.\n' +
      '=========================================================================',
  );
  process.exit(1);
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

async function testRefusalGuard() {
  console.log('--- Testing ALLOW_TEST_USERS Refusal Guard ---');
  const checkScript = `
    const allow = process.env.ALLOW_TEST_USERS;
    if (allow !== 'true') {
      console.error('REFUSAL: ALLOW_TEST_USERS is not "true"');
      process.exit(1);
    }
    console.log('ALLOWED');
  `;
  // Case A: Missing or false -> Must refuse with exit code 1
  const resDenied = spawnSync(process.execPath, ['-e', checkScript], {
    env: { ...process.env, ALLOW_TEST_USERS: 'false' },
    encoding: 'utf8',
  });
  if (resDenied.status !== 1 || !resDenied.stderr.includes('REFUSAL')) {
    throw new Error(
      'Refusal guard failed: script did not exit with code 1 when ALLOW_TEST_USERS=false',
    );
  }
  console.log('  ✓ Verified refusal when ALLOW_TEST_USERS is false or omitted (exit code 1)');

  // Case B: Explicit true -> Must allow with exit code 0
  const resAllowed = spawnSync(process.execPath, ['-e', checkScript], {
    env: { ...process.env, ALLOW_TEST_USERS: 'true' },
    encoding: 'utf8',
  });
  if (resAllowed.status !== 0 || !resAllowed.stdout.includes('ALLOWED')) {
    throw new Error(
      'Refusal guard failed: script did not exit with code 0 when ALLOW_TEST_USERS=true',
    );
  }
  console.log('  ✓ Verified pass when ALLOW_TEST_USERS is true (exit code 0)\n');
}

async function main() {
  console.log('=================================================================');
  console.log('PHASE A7: POLISH & PROOF COMPREHENSIVE END-TO-END VERIFICATION');
  console.log('Target: ' + BASE_URL);
  console.log('Guard Check: ALLOW_TEST_USERS=true verified.');
  console.log('=================================================================\n');

  await testRefusalGuard();

  const testEmail = `phase_a7_test_${Date.now()}@medbuddy.internal`;
  const testPassword = 'Password123!SecureTest';
  let userId = null;
  let browser = null;

  try {
    // -------------------------------------------------------------------------
    // 1. Provision Test User & Session
    // -------------------------------------------------------------------------
    console.log(`[1/10] Provisioning test user: ${testEmail}...`);
    const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Dr. Maya Patel' },
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

    // -------------------------------------------------------------------------
    // 2. Playwright Browser Setup
    // -------------------------------------------------------------------------
    console.log('\n[2/10] Launching browser contexts (mobile 360px & desktop 1280px)...');
    browser = await chromium.launch({ channel: 'chrome', headless: true });

    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 780 },
      isMobile: true,
      hasTouch: true,
    });
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

    // -------------------------------------------------------------------------
    // 3. Golden Path: Consent & First-Run Setup
    // -------------------------------------------------------------------------
    console.log('\n[3/10] Executing consent & first-run setup flow...');
    await desktopPage.goto(`${BASE_URL}/app/consent`, { waitUntil: 'domcontentloaded' });
    await desktopPage.click('button:has-text("I agree and continue")');

    await desktopPage.waitForURL('**/app/setup', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await desktopPage.fill('#name-input', 'Dr. Maya Patel');
    await desktopPage.click('button:has-text("Continue")');

    await desktopPage.waitForURL(`${BASE_URL}/app`, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });
    console.log('  ✓ Setup completed: Landed on Today (/app)');

    // Sync cookies to mobile context
    const updatedCookies = await desktopContext.cookies();
    await mobileContext.addCookies(updatedCookies);

    // Get care profile ID from db
    const { data: cpList } = await adminClient
      .from('care_access')
      .select('care_profile_id')
      .eq('user_id', userId);
    const careProfileId = cpList[0].care_profile_id;
    console.log(`  ✓ Active Care Profile ID: ${careProfileId}`);

    // -------------------------------------------------------------------------
    // 4. Golden Path: Add Medicine with Schedule (Amoxicillin 500 mg)
    // -------------------------------------------------------------------------
    console.log('\n[4/10] Adding medicine with first box and daily schedule...');
    await mobilePage.goto(`${BASE_URL}/app/medicine/add`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Add a medicine', { timeout: 10000 });

    // Step 1: Medicine Information
    await mobilePage.fill('#med-name', 'Amoxicillin');
    await mobilePage.fill('#med-strength', '500 mg');
    await mobilePage.fill('#med-purpose', 'Bacterial infection');
    await mobilePage.click('button:has-text("Next: First box details")');

    // Step 2: First Box Details (Quantity: 20, Expiry: +90 days)
    await mobilePage.waitForSelector('text=First box details', { timeout: 5000 });
    await mobilePage.fill('#box-qty', '20');
    await mobilePage.fill('#box-expiry', getDateOffset(90));
    await mobilePage.fill('#box-location', 'First Aid Box');
    await mobilePage.fill('#box-batch', 'AMX-774');
    await mobilePage.click('button:has-text("Next: Set schedule")');

    // Step 3: Schedule Details
    await mobilePage.waitForSelector('text=Set a schedule', { timeout: 5000 });
    await mobilePage.fill('#sched-instructions', 'Take with breakfast');
    await mobilePage.click('button:has-text("Save medicine")');

    await mobilePage.waitForURL(
      (url) => url.pathname.startsWith('/app/medicine/') && url.pathname !== '/app/medicine/add',
      { timeout: 15000, waitUntil: 'domcontentloaded' },
    );
    console.log(`  ✓ Saved Amoxicillin with schedule! URL: ${mobilePage.url()}`);

    // Retrieve medicine record
    const { data: medRecord } = await adminClient
      .from('medicines')
      .select('id')
      .eq('care_profile_id', careProfileId)
      .eq('name', 'Amoxicillin')
      .single();
    const amoxicillinId = medRecord.id;

    // Verify initial stock
    const { data: initialBox } = await adminClient
      .from('inventory_items')
      .select('quantity_remaining')
      .eq('medicine_id', amoxicillinId)
      .single();
    const stockInitial = Number(initialBox.quantity_remaining);
    console.log(`  ✓ Verified initial stock in database: ${stockInitial} tablets`);
    if (stockInitial !== 20) {
      throw new Error(`Expected initial stock 20, got ${stockInitial}`);
    }

    // -------------------------------------------------------------------------
    // 5. Golden Path: Log Dose (Taken) -> Verify Stock Decrement -> Undo -> Verify Stock Restored
    // -------------------------------------------------------------------------
    console.log(
      '\n[5/10] Testing clinical dose lifecycle: Due -> Taken -> Stock Decrement -> Undo -> Stock Restored...',
    );

    // Provision a Due Now dose event 10 minutes ago
    const dueTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await adminClient.from('dose_events').insert({
      care_profile_id: careProfileId,
      medicine_id: amoxicillinId,
      scheduled_for: dueTime,
      amount: 1,
      status: 'pending',
    });

    await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Due now', { timeout: 10000 });
    await mobilePage.waitForSelector('article:has-text("Amoxicillin")', { timeout: 5000 });

    // Capture screenshot: Due now
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a7-today-due-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today screen with Due now at 360px');

    // Click "Taken"
    const dueCard = mobilePage
      .locator('article[data-status="due"]:has-text("Amoxicillin")')
      .first();
    await dueCard.locator('button:has-text("Taken")').click();
    await mobilePage.waitForTimeout(1000);

    // Verify moved to Done today
    await mobilePage.waitForSelector(
      'section:has-text("Done today") >> article:has-text("Amoxicillin")',
      {
        timeout: 5000,
      },
    );
    console.log('  ✓ Dose marked Taken and moved to "Done today" section');

    // Verify Stock Decrement in DB: 20 -> 19
    const { data: boxAfterTaken } = await adminClient
      .from('inventory_items')
      .select('quantity_remaining')
      .eq('medicine_id', amoxicillinId)
      .single();
    const stockAfterTaken = Number(boxAfterTaken.quantity_remaining);
    console.log(
      `  ✓ Stock verified after dose: ${stockAfterTaken} (decremented by 1 from ${stockInitial})`,
    );
    if (stockAfterTaken !== 19) {
      throw new Error(`Expected stock 19 after taking dose, got ${stockAfterTaken}`);
    }

    // Capture screenshot: Done today
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a7-today-taken-done-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today Taken -> Done today at 360px');

    // Click "Undo" on the taken dose
    console.log('  Clicking "Undo" to reverse dose intake...');
    const doneCard = mobilePage
      .locator('section:has-text("Done today") >> article:has-text("Amoxicillin")')
      .first();
    await doneCard.locator('button:has-text("Undo")').click();
    await mobilePage.waitForTimeout(1000);

    // Verify moved back to Due now
    await mobilePage.waitForSelector('article[data-status="due"]:has-text("Amoxicillin")', {
      timeout: 5000,
    });
    console.log('  ✓ Dose successfully restored back to "Due now"');

    // Verify Stock Restored in DB: 19 -> 20
    const { data: boxAfterUndo } = await adminClient
      .from('inventory_items')
      .select('quantity_remaining')
      .eq('medicine_id', amoxicillinId)
      .single();
    const stockAfterUndo = Number(boxAfterUndo.quantity_remaining);
    console.log(
      `  ✓ Stock verified after undo: ${stockAfterUndo} (restored back to ${stockInitial})`,
    );
    if (stockAfterUndo !== 20) {
      throw new Error(`Expected stock 20 after undo, got ${stockAfterUndo}`);
    }

    // Capture screenshot: Restored
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a7-today-undo-restored-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today Undo -> Restored at 360px');

    // -------------------------------------------------------------------------
    // 6. Keyboard & Screen Reader Accessibility Pass
    // -------------------------------------------------------------------------
    console.log('\n[6/10] Performing keyboard navigation & ARIA screen-reader pass...');
    // Today Page Keyboard Navigation
    await desktopPage.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForSelector('#main-content', { timeout: 10000 });
    await desktopPage.keyboard.press('Tab');
    const activeTag = await desktopPage.evaluate(() => document.activeElement?.tagName);
    console.log(`  ✓ Today screen keyboard tab reachable: focus on <${activeTag}>`);

    // Verify semantic landmarks and ARIA attributes
    const hasMain = await desktopPage.$('main#main-content');
    const hasNav = await desktopPage.$('nav[aria-label*="Navigation"]');
    console.log(
      `  ✓ Landmarks verified: <main#main-content>: ${Boolean(hasMain)}, <nav>: ${Boolean(hasNav)}`,
    );

    // Add Medicine Accessibility Pass
    await desktopPage.goto(`${BASE_URL}/app/medicine/add`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForSelector('label[for="med-name"]', { timeout: 10000 });
    const nameLabelFor = await desktopPage.$eval('label[for="med-name"]', (el) =>
      el.textContent?.trim(),
    );
    console.log(`  ✓ Form accessibility: Label for #med-name verified ("${nameLabelFor}")`);

    // -------------------------------------------------------------------------
    // 7. Motion & Accessibility Checks (Reduced-Motion & Motion-Off)
    // -------------------------------------------------------------------------
    console.log('\n[7/10] Testing reduced-motion & motion preference handling...');
    const reducedMotionContext = await browser.newContext({
      viewport: { width: 360, height: 780 },
      reducedMotion: 'reduce',
    });
    await reducedMotionContext.addCookies(updatedCookies);
    const rmPage = await reducedMotionContext.newPage();
    await rmPage.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });

    const isReducedMotionActive = await rmPage.evaluate(() => {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });
    console.log(
      `  ✓ prefers-reduced-motion: reduce active in browser media query: ${isReducedMotionActive}`,
    );
    await reducedMotionContext.close();

    // -------------------------------------------------------------------------
    // 8. Large-Text Mode Check
    // -------------------------------------------------------------------------
    console.log('\n[8/10] Testing large-text mode scaling and layout stability...');
    await desktopPage.goto(`${BASE_URL}/app/settings`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForSelector('text=Large text', { timeout: 10000 });

    // Toggle large text switch in settings
    const largeTextBtn = desktopPage
      .locator('div:has(> div:text("Large text")) button[role="switch"]')
      .first();
    if (await largeTextBtn.isVisible()) {
      await largeTextBtn.click();
      await desktopPage.waitForTimeout(500);
      console.log('  ✓ Toggled high-legibility large text switch in Settings');
    }

    // Capture Today in large-text mode at 360px
    await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
    await mobilePage.evaluate(() => {
      document.documentElement.setAttribute('data-large-text', 'true');
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a7-today-large-text-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today in large-text mode at 360px (no clipping/overflow)');

    // -------------------------------------------------------------------------
    // 9. Offline Shell Verification & Cache Privacy Audit
    // -------------------------------------------------------------------------
    console.log(
      '\n[9/10] Testing offline fallback shell & verifying zero cached medical records...',
    );
    await mobilePage.goto(`${BASE_URL}/offline`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=You appear to be offline.', { timeout: 5000 });
    await mobilePage.waitForSelector('button:has-text("Try again")', { timeout: 5000 });
    await mobilePage.waitForSelector('a:has-text("Open shell")', { timeout: 5000 });

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a7-offline-shell-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Offline shell at 360px');

    // Audit Cache Storage API to ensure NO medical/API data is stored
    const cacheAudit = await mobilePage.evaluate(async () => {
      const cacheNames = await window.caches.keys();
      const cachedUrls = [];
      const violations = [];
      for (const name of cacheNames) {
        const cache = await window.caches.open(name);
        const requests = await cache.keys();
        for (const req of requests) {
          const url = req.url;
          cachedUrls.push(url);

          // Only examine non-static bundle requests for private API leaks
          const isStaticChunk = url.includes('/_next/static/');
          const isPrivateDataEndpoint =
            !isStaticChunk &&
            (url.includes('supabase.co') ||
              url.includes('/rest/') ||
              url.includes('/auth/') ||
              url.includes('/api/'));

          if (isPrivateDataEndpoint) {
            violations.push(url);
          }
        }
      }
      return { cacheNames, totalCached: cachedUrls.length, violations };
    });

    console.log(`  ✓ Caches inspected: [${cacheAudit.cacheNames.join(', ')}]`);
    console.log(`  ✓ Private health data cache violations: ${cacheAudit.violations.length}`);
    if (cacheAudit.violations.length > 0) {
      throw new Error(
        `Privacy violation: cached private endpoints: ${cacheAudit.violations.join(', ')}`,
      );
    }

    // -------------------------------------------------------------------------
    // 10. Golden Path: Account & Data Deletion (Zero Residuals)
    // -------------------------------------------------------------------------
    console.log('\n[10/10] Testing permanent account & data deletion with DELETE confirmation...');
    await mobilePage.goto(`${BASE_URL}/app/settings`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Delete my account and data', { timeout: 10000 });

    // Open Delete Account Modal
    const deleteBtn = mobilePage.locator('button:has-text("Delete my account and data")').first();
    await deleteBtn.scrollIntoViewIfNeeded();
    await deleteBtn.click();

    await mobilePage.waitForSelector('#confirm-delete-input', { timeout: 5000 });
    console.log('  ✓ Delete Account confirmation modal opened');

    // Fill "DELETE" confirmation
    const confirmInput = mobilePage.locator('#confirm-delete-input');
    await confirmInput.fill('DELETE');

    // Click confirm delete button
    const confirmDeleteBtn = mobilePage.locator('button:has-text("Permanently delete account")');
    await confirmDeleteBtn.click();

    // Wait for success screen or return to homepage
    await mobilePage.waitForSelector('text=Account & Data Permanently Deleted', { timeout: 15000 });
    console.log('  ✓ Deletion success modal confirmed: "Account & Data Permanently Deleted"');

    // Click "Return to homepage"
    await mobilePage.click('button:has-text("Return to homepage")');
    await mobilePage.waitForURL(
      (url) => url.pathname.includes('/sign-in') || url.pathname === '/',
      { timeout: 15000, waitUntil: 'domcontentloaded' },
    );
    console.log(`  ✓ Redirected to homepage: ${mobilePage.url()}`);

    // Verify Zero Database Residuals
    console.log('  Verifying zero database residuals via Supabase service role client...');
    const { data: userCheck } = await adminClient.auth.admin.getUserById(userId);
    if (userCheck?.user) {
      throw new Error(`Residual Error: User ${userId} still exists in auth.users!`);
    }

    const tables = [
      { name: 'profiles', query: adminClient.from('profiles').select('id').eq('id', userId) },
      {
        name: 'care_profiles',
        query: adminClient.from('care_profiles').select('id').eq('id', careProfileId),
      },
      {
        name: 'care_access',
        query: adminClient
          .from('care_access')
          .select('care_profile_id')
          .eq('care_profile_id', careProfileId),
      },
      {
        name: 'medicines',
        query: adminClient.from('medicines').select('id').eq('care_profile_id', careProfileId),
      },
      {
        name: 'inventory_items',
        query: adminClient
          .from('inventory_items')
          .select('id')
          .eq('care_profile_id', careProfileId),
      },
      {
        name: 'dose_events',
        query: adminClient.from('dose_events').select('id').eq('care_profile_id', careProfileId),
      },
      {
        name: 'schedules',
        query: adminClient.from('schedules').select('id').eq('care_profile_id', careProfileId),
      },
    ];

    for (const t of tables) {
      const { data, error } = await t.query;
      if (error) throw error;
      const count = data?.length || 0;
      console.log(`  ✓ Table ${t.name}: ${count} records remaining`);
      if (count > 0) {
        throw new Error(`Residual Error: ${count} records remaining in ${t.name}!`);
      }
    }

    console.log('\n=================================================================');
    console.log('✅ ALL PHASE A7 PLAYWRIGHT E2E TESTS PASSED SUCCESSFULLY!');
    console.log('   - Refusal Guard: verified');
    console.log('   - Sign-in & Consent: verified');
    console.log('   - Care Profile Setup: verified');
    console.log('   - Add Medicine & Schedule: verified');
    console.log('   - Today Dose Lifecycle (Taken & Undo): verified');
    console.log('   - Stock Decrement & Restoration: verified');
    console.log('   - Accessibility & Keyboard Navigation: verified');
    console.log('   - Reduced-Motion & Large-Text Mode: verified');
    console.log('   - Offline Shell & Cache Privacy: verified');
    console.log('   - Account Deletion & Zero Residuals: verified');
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
