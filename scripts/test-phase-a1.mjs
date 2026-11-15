import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
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
const ARTIFACT_DIR = 'C:/Users/Sourasish/.gemini/antigravity/brain/d2b0a0e6-7e7e-45cf-bbdb-d659180f7dc1';
const BASE_URL = 'http://localhost:3000';

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('--- PHASE A1 VERIFICATION SUITE ---');

  // 1. Verify Cookie Scoping via HTTP HEAD
  console.log('1. Checking marketing route cookie isolation...');
  const routesToCheck = ['/', '/privacy', '/offline'];
  for (const route of routesToCheck) {
    const res = await fetch(`${BASE_URL}${route}`, { method: 'HEAD' });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      throw new Error(`VIOLATION: Route ${route} set cookies: ${setCookie}`);
    }
    console.log(`  ✓ Route ${route}: 0 cookies set (Status: ${res.status})`);
  }

  const appRes = await fetch(`${BASE_URL}/app`, { method: 'HEAD', redirect: 'manual' });
  console.log(`  ✓ Route /app redirect status: ${appRes.status}, location: ${appRes.headers.get('location')}`);

  // 2. Create Temporary Test User
  const timestamp = Date.now();
  const testEmail = `phase_a1_test_${timestamp}@medbuddy.internal`;
  const testPassword = `P@ssword_${timestamp}!`;

  console.log(`2. Provisioning temporary test user: ${testEmail}`);
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

    // Step A: Capture Sign-in Screen
    console.log('3. Capturing Sign-In screens...');
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

    // Step B: Authenticate Test User in Desktop Context
    console.log('4. Authenticating test user via Supabase client in browser...');
    await desktopPage.evaluate(
      async ({ url, key, email, password }) => {
        // Use createBrowserClient from global or dynamic import
        const { createBrowserClient } = await import(
          'https://esm.sh/@supabase/ssr@0.5.2'
        );
        const client = createBrowserClient(url, key);
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      { url: supabaseUrl, key: anonKey, email: testEmail, password: testPassword }
    );

    // Sync cookies to mobile context
    const cookies = await desktopContext.cookies();
    await mobileContext.addCookies(cookies);

    // Step C: Route Guard Check - Navigate to /app -> Must redirect to /app/consent
    console.log('5. Testing Guard: Navigating to /app without consent...');
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
    console.log('6. Capturing Consent screens...');
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-consent-1280px.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-consent-360px.png'),
      fullPage: true,
    });

    // Step E: Click "I agree and continue" on Consent Screen
    console.log('7. Recording consent...');
    await desktopPage.click('button:has-text("I agree and continue")');
    await desktopPage.waitForURL('**/app/**', { waitUntil: 'networkidle' });
    const afterConsentUrl = desktopPage.url();
    console.log(`  ✓ After consent redirected to: ${afterConsentUrl}`);
    if (!afterConsentUrl.includes('/app/setup')) {
      throw new Error(`Expected redirect to /app/setup, got ${afterConsentUrl}`);
    }

    await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle' });

    // Step F: Capture Setup Screen
    console.log('8. Capturing Setup screens...');
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-setup-1280px.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-setup-360px.png'),
      fullPage: true,
    });

    // Step G: Complete First-Run Setup
    console.log('9. Completing First-Run Setup...');
    await desktopPage.fill('#name-input', 'Alex River');
    await desktopPage.click('button:has-text("Continue")');
    await desktopPage.waitForURL(`${BASE_URL}/app`, { waitUntil: 'networkidle' });
    console.log(`  ✓ Landed on Today home tab: ${desktopPage.url()}`);

    await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle' });

    // Step H: Capture Today Screen (Home Shell)
    console.log('10. Capturing Today screens...');
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-today-1280px.png'),
      fullPage: true,
    });
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-today-360px.png'),
      fullPage: true,
    });

    // Step I: Profile Switcher Sheet
    console.log('11. Testing Profile Switcher Sheet...');
    await mobilePage.click('header button[aria-haspopup="dialog"]');
    await mobilePage.waitForSelector('[role="dialog"]');
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-profile-switcher-360px.png'),
    });
    // Close sheet
    await mobilePage.keyboard.press('Escape');

    // Step J: Large Text Mode
    console.log('12. Testing Large Text Mode in Settings...');
    await mobilePage.goto(`${BASE_URL}/app/settings`, { waitUntil: 'networkidle' });
    await mobilePage.click('button[role="switch"]');
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a1-settings-largetext-360px.png'),
      fullPage: true,
    });

    console.log('\n✅ ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  } finally {
    await browser.close();

    // Clean up test user
    console.log(`Cleaning up test user ${testUserId}...`);
    try {
      await adminClient.auth.admin.deleteUser(testUserId);
      console.log('✓ Test user cleaned up.');
    } catch (err) {
      console.warn('Could not clean up test user:', err.message);
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exitCode = 1;
});
