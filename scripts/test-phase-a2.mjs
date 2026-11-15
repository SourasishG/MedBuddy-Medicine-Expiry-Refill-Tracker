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

if (env.ALLOW_TEST_USERS !== 'true') {
  console.error('Refusing to run: ALLOW_TEST_USERS must be true');
  process.exit(1);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const ARTIFACT_DIR =
  'C:/Users/Sourasish/.gemini/antigravity/brain/d2b0a0e6-7e7e-45cf-bbdb-d659180f7dc1';
const BASE_URL = 'http://localhost:3000';

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=================================================================');
  console.log('PHASE A2: SETUP & CARE PROFILES VERIFICATION SUITE');
  console.log('=================================================================\n');

  // Step 1: Create fresh test user
  const timestamp = Date.now();
  const testEmail = `phase_a2_test_${timestamp}@medbuddy.internal`;
  const testPassword = `TestPass!_${timestamp}_Secure#1`;

  console.log(`Step 1: Provisioning test user: ${testEmail}`);
  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (createError || !userData?.user) {
    throw new Error(`Failed to create test user: ${createError?.message}`);
  }
  const userId = userData.user.id;
  console.log(`  ✓ Test user created with ID: ${userId}`);

  let browser;
  try {
    // Authenticate and get SSR cookies
    const { data: sessionData, error: authError } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (authError || !sessionData?.session) {
      throw new Error(`Auth failed: ${authError?.message}`);
    }

    const cookieJar = [];
    const ssrClient = createServerClient(supabaseUrl, anonKey, {
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

    browser = await chromium.launch({ channel: 'chrome', headless: true });

    // Desktop (1280px) and Mobile (360px) contexts
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const mobileContext = await browser.newContext({ viewport: { width: 360, height: 740 } });

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

    const desktopPage = await desktopContext.newPage();
    const mobilePage = await mobileContext.newPage();

    // Step 2: Navigate to /app -> redirected to /app/consent
    console.log('\nStep 2: Navigating to /app without consent...');
    await desktopPage.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
    console.log(`  ✓ Desktop redirected to: ${desktopPage.url()}`);
    if (!desktopPage.url().includes('/app/consent')) {
      throw new Error(`Expected redirect to /app/consent, got ${desktopPage.url()}`);
    }

    // Step 3: Record consent
    console.log('\nStep 3: Recording consent...');
    await desktopPage.click('button:has-text("I agree and continue")');
    await desktopPage.waitForURL('**/app/setup', { timeout: 15000, waitUntil: 'domcontentloaded' });
    console.log(`  ✓ After consent redirected to: ${desktopPage.url()}`);

    // Sync mobile to setup
    await mobilePage.goto(`${BASE_URL}/app/setup`, { waitUntil: 'domcontentloaded' });

    // Step 4: Capture First-Run Setup Screens
    console.log('\nStep 4: Capturing First-Run Setup screens...');
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a2-setup-1280px.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a2-setup-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured setup screens at 360px and 1280px');

    // Step 5: Complete First-Run Setup (For myself, Alex River, reminders checked)
    console.log('\nStep 5: Submitting First-Run Setup for "Alex River"...');
    await desktopPage.fill('#name-input', 'Alex River');
    await desktopPage.click('button:has-text("Continue")');
    await desktopPage.waitForURL(`${BASE_URL}/app`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await desktopPage.waitForSelector('text=Alex River', { timeout: 10000 });
    console.log(`  ✓ Landed on Today screen with active profile "Alex River"!`);

    // Sync mobile context to /app
    const updatedCookies = await desktopContext.cookies();
    await mobileContext.addCookies(updatedCookies);
    await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Alex River', { timeout: 10000 });

    // Step 6: Capture Empty Today Screens
    console.log('\nStep 6: Capturing Empty Today screens...');
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a2-today-empty-1280px.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a2-today-empty-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Empty Today screens at 360px and 1280px');

    // Step 7: Open Profile Switcher Sheet
    console.log('\nStep 7: Testing Profile Switcher Sheet...');
    await mobilePage.click('button[aria-label*="Switch care profile"]');
    await mobilePage.waitForSelector('text=Care Profiles', { timeout: 5000 });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a2-profile-switcher-360px.png'),
    });
    console.log('  ✓ Captured Profile Switcher Sheet at 360px');

    // Step 8: Add a second care profile ("Someone else", "Mum")
    console.log('\nStep 8: Adding second care profile "Mum" via setup?mode=new...');
    await mobilePage.click('a:has-text("Add another care profile")');
    await mobilePage.waitForURL('**/app/setup?mode=new', {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });

    // Select "Someone else"
    await mobilePage.click('button:has-text("Someone else")');
    await mobilePage.fill('#name-input', 'Mum');
    await mobilePage.click('button:has-text("Continue")');
    await mobilePage.waitForURL(`${BASE_URL}/app`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await mobilePage.waitForSelector('text=Mum', { timeout: 10000 });
    console.log('  ✓ Successfully added "Mum" and activated her profile on Today screen!');

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a2-today-mum-empty-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Empty Today screen for "Mum" at 360px');

    // Step 9: Switch back to "Alex River" via Profile Switcher
    console.log('\nStep 9: Switching back to "Alex River" via Profile Switcher...');
    await mobilePage.click('button[aria-label*="Switch care profile"]');
    await mobilePage.waitForSelector('text=Care Profiles', { timeout: 5000 });
    await mobilePage.click('button[role="radio"]:has-text("Alex River")');
    await mobilePage.waitForSelector('text=Alex River', { timeout: 5000 });
    console.log('  ✓ Successfully switched active profile back to "Alex River"!');

    // Step 10: Rename care profile in Settings
    console.log('\nStep 10: Renaming profile in Settings...');
    await mobilePage.goto(`${BASE_URL}/app/settings`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Care Profiles', { timeout: 10000 });

    // Find the profile item for "Mum" and click "Edit"
    const mumCard = mobilePage.locator('div[class*="profileItem"]', { hasText: 'Mum' });
    await mumCard.locator('button:has-text("Edit")').click();

    // Fill in new name "Asha (Mum)"
    const nameInput = mumCard.locator('input[id*="edit-name"]');
    await nameInput.fill('Asha (Mum)');

    // Adjust snooze to 20 minutes
    const snoozeSelect = mumCard.locator('select[id*="edit-snooze"]');
    await snoozeSelect.selectOption('20');

    // Save changes
    await mumCard.locator('button:has-text("Save changes")').click();
    await mobilePage.waitForSelector('text=Care profile updated successfully!', { timeout: 5000 });
    console.log('  ✓ Successfully saved profile rename to "Asha (Mum)"!');

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a2-settings-profiles-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Care Profiles Settings screen at 360px');

    console.log('\n=================================================================');
    console.log('✅ ALL PHASE A2 VERIFICATION CHECKS PASSED WITH FLYING COLORS!');
    console.log('=================================================================\n');
  } finally {
    if (browser) await browser.close();

    console.log(`Cleaning up test user ${userId}...`);
    await adminClient.auth.admin.deleteUser(userId);
    console.log('✓ Test user deleted cleanly.');
  }
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
