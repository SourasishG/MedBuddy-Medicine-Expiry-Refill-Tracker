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
  console.log('PHASE A1: FOUNDATION VERIFICATION SUITE');
  console.log('=================================================================\n');

  // 1. Verify Cookie Scoping via HTTP HEAD
  console.log('Step 1: Checking marketing route cookie isolation...');
  const routesToCheck = ['/', '/privacy', '/offline'];
  for (const route of routesToCheck) {
    const res = await fetch(`${BASE_URL}${route}`, { method: 'HEAD' });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      throw new Error(`VIOLATION: Route ${route} set cookies: ${setCookie}`);
    }
    console.log(`  ✓ Route ${route}: 0 cookies set (HTTP ${res.status})`);
  }

  const appRes = await fetch(`${BASE_URL}/app`, { method: 'HEAD', redirect: 'manual' });
  console.log(
    `  ✓ Route /app guard redirect: HTTP ${appRes.status} -> ${appRes.headers.get('location')}`,
  );

  // 2. Create Temporary Test User
  const timestamp = Date.now();
  const testEmail = `phase_a1_test_${timestamp}@medbuddy.internal`;
  const testPassword = `P@ssword_${timestamp}!`;

  console.log(`\nStep 2: Provisioning test user: ${testEmail}`);
  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (userError || !userData?.user) {
    throw new Error(`Failed to create test user: ${userError?.message}`);
  }
  const testUserId = userData.user.id;
  console.log(`  ✓ Test user created with ID: ${testUserId}`);

  // Obtain real session tokens via Supabase client
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (authError || !authData.session) {
    throw new Error(`Failed to sign in test user: ${authError?.message}`);
  }

  // Generate SSR cookies
  let ssrCookies = [];
  const serverClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (c) => {
        ssrCookies = c;
      },
    },
  });
  await serverClient.auth.setSession({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  });
  console.log(`  ✓ Generated ${ssrCookies.length} SSR cookie(s) for authentication`);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  try {
    // 3. Desktop Context (1280px)
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 850 },
      deviceScaleFactor: 2,
      colorScheme: 'dark',
    });
    const desktopPage = await desktopContext.newPage();

    // 4. Mobile Context (360px)
    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 780 },
      deviceScaleFactor: 2,
      colorScheme: 'dark',
    });
    const mobilePage = await mobileContext.newPage();

    // Step A: Capture Sign-In Screen (Unauthenticated)
    console.log('\nStep 3: Capturing Sign-In screens...');
    await desktopPage.goto(`${BASE_URL}/app/sign-in`, { waitUntil: 'networkidle' });
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-sign-in-1280px.png'),
      fullPage: true,
    });

    await mobilePage.goto(`${BASE_URL}/app/sign-in`, { waitUntil: 'networkidle' });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-sign-in-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured sign-in screens at 360px and 1280px');

    // Step B: Set SSR Cookies in Both Contexts
    console.log('\nStep 4: Setting authenticated session cookies...');
    const playwrightCookies = ssrCookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }));
    await desktopContext.addCookies(playwrightCookies);
    await mobileContext.addCookies(playwrightCookies);

    // Step C: Route Guard Check: Authenticated, but no consent -> Must redirect to /app/consent
    console.log('\nStep 5: Testing Route Guard: navigating to /app without consent...');
    await desktopPage.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle' });
    const currentUrlDesktop = desktopPage.url();
    console.log(`  ✓ Desktop redirected to: ${currentUrlDesktop}`);
    if (!currentUrlDesktop.includes('/app/consent')) {
      throw new Error(`Expected redirect to /app/consent, got ${currentUrlDesktop}`);
    }

    await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle' });
    const currentUrlMobile = mobilePage.url();
    console.log(`  ✓ Mobile redirected to: ${currentUrlMobile}`);

    // Step D: Capture Consent Screen
    console.log('\nStep 6: Capturing Consent screens...');
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-consent-1280px.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-consent-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured consent screens at 360px and 1280px');

    // Step E: Click "I agree and continue" on Consent Screen
    console.log('\nStep 7: Recording consent...');
    await desktopPage.click('button:has-text("I agree and continue")');
    await desktopPage.waitForURL('**/app/setup', { timeout: 15000, waitUntil: 'networkidle' });
    const afterConsentUrl = desktopPage.url();
    console.log(`  ✓ After consent redirected to: ${afterConsentUrl}`);
    if (!afterConsentUrl.includes('/app/setup')) {
      throw new Error(`Expected redirect to /app/setup, got ${afterConsentUrl}`);
    }

    // Refresh mobile context to sync
    const updatedCookies = await desktopContext.cookies();
    await mobileContext.addCookies(updatedCookies);
    await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle' });

    // Step F: Capture Setup Screen
    console.log('\nStep 8: Capturing First-Run Setup screens...');
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-setup-1280px.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-setup-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured setup screens at 360px and 1280px');

    // Step G: Complete First-Run Setup (Call fn_create_care_profile)
    console.log('\nStep 9: Completing First-Run Setup...');
    await desktopPage.fill('#name-input', 'Alex River');
    await desktopPage.click('button:has-text("Continue")');
    await desktopPage.waitForURL(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log(`  ✓ Setup completed! Landed on Today home tab: ${desktopPage.url()}`);

    const postSetupCookies = await desktopContext.cookies();
    await mobileContext.addCookies(postSetupCookies);
    await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForTimeout(1000);
    await mobilePage.waitForTimeout(1000);

    // Step H: Capture Today Screen (Home Shell)
    console.log('\nStep 10: Capturing Today screens...');
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-today-1280px.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-today-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Today screens at 360px and 1280px');

    // Step I: Profile Switcher Sheet
    console.log('\nStep 11: Testing Profile Switcher Sheet...');
    await mobilePage.click('header button[aria-haspopup="dialog"]');
    await mobilePage.waitForSelector('[role="dialog"]');
    await mobilePage.waitForTimeout(300);
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-profile-switcher-360px.png'),
    });
    console.log('  ✓ Captured Profile Switcher Sheet at 360px');
    await mobilePage.keyboard.press('Escape');

    // Step J: Large Text Mode in Settings
    console.log('\nStep 12: Testing Large Text Mode in Settings...');
    await mobilePage.goto(`${BASE_URL}/app/settings`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(500);
    await mobilePage.click('button[role="switch"]');
    await mobilePage.waitForTimeout(600);
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-settings-largetext-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Large Text Mode at 360px');

    // Step K: Sign Out Flow
    console.log('\nStep 13: Testing Sign-Out Flow...');
    await mobilePage.click('button:has-text("Sign out of MedBuddy")');
    await mobilePage.waitForURL('**/app/sign-in', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log(`  ✓ Signed out successfully! Navigated back to: ${mobilePage.url()}`);

    console.log('\n=================================================================');
    console.log('✅ ALL PHASE A1 VERIFICATION CHECKS PASSED WITH FLYING COLORS!');
    console.log('=================================================================');
  } finally {
    await browser.close();

    // Clean up test user
    console.log(`\nCleaning up test user ${testUserId}...`);
    try {
      await adminClient.auth.admin.deleteUser(testUserId);
      console.log('✓ Test user deleted cleanly.');
    } catch (err) {
      console.warn('Could not clean up test user:', err.message);
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exitCode = 1;
});
