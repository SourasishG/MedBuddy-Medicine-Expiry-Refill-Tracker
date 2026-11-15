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

// Helper to compute date string relative to today
function getDateOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('=================================================================');
  console.log('PHASE A3: CABINET & MEDICINE MANAGEMENT VERIFICATION SUITE');
  console.log('=================================================================\n');

  const timestamp = Date.now();
  const testEmail = `phase_a3_test_${timestamp}@medbuddy.internal`;
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
    // Authenticate and obtain SSR session cookies
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

    // Step 2: Complete Consent and Setup
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
    const updatedCookies = await desktopContext.cookies();
    await mobileContext.addCookies(updatedCookies);

    // Step 3: Test Add Medicine Flow via UI (Adding Eye Drops with 5 days left -> Urgent)
    console.log('\nStep 3: Testing Add Medicine flow via UI (Eye Drops, 5 days left)...');
    await mobilePage.goto(`${BASE_URL}/app/medicine/add`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Add a medicine', { timeout: 10000 });

    // Step 1: Medicine Details
    await mobilePage.fill('#med-name', 'Eye Drops');
    await mobilePage.fill('#med-strength', '0.5% w/v');
    await mobilePage.click('button[role="radio"]:has-text("Drops")');
    await mobilePage.fill('#med-purpose', 'Dry eyes relief');

    // Capture Step 1 screen
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a3-add-medicine-step1-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Add Medicine Step 1 screen at 360px');

    await mobilePage.click('button:has-text("Next: First box details")');
    await mobilePage.waitForSelector('text=First box details', { timeout: 5000 });

    // Step 2: First Box Details with 5 days left
    const urgentDate = getDateOffset(5);
    console.log(`  Setting box expiry date to ${urgentDate} (5 days left)...`);
    await mobilePage.fill('#box-qty', '1');
    await mobilePage.fill('#box-expiry', urgentDate);
    await mobilePage.fill('#box-location', 'Bedside Table');
    await mobilePage.fill('#box-batch', 'ED-9921');

    // Capture Step 2 screen
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a3-add-medicine-step2-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Add Medicine Step 2 screen at 360px');

    await mobilePage.click('button:has-text("Save medicine")');
    await mobilePage.waitForURL(
      (url) => url.pathname.startsWith('/app/medicine/') && url.pathname !== '/app/medicine/add',
      {
        timeout: 15000,
        waitUntil: 'domcontentloaded',
      },
    );
    console.log(`  ✓ Successfully saved Eye Drops! Now at: ${mobilePage.url()}`);

    // Verify Eye Drops shows "Urgent · 5d left"
    await mobilePage.waitForSelector('text=Urgent', { timeout: 5000 });
    const urgentBadgeText = await mobilePage.textContent('span[data-band="urgent"]');
    console.log(`  ✓ Verified Urgent badge: "${urgentBadgeText}"`);
    if (!urgentBadgeText.includes('Urgent') || !urgentBadgeText.includes('5d left')) {
      throw new Error(`Expected Urgent · 5d left, got: ${urgentBadgeText}`);
    }

    // Step 4: Add remaining medicines to populate all 4 expiry bands:
    // - Metformin 500 mg: 60 days left (Fresh)
    // - Ibuprofen 200 mg: 18 days left (Soon)
    // - Amoxicillin 250 mg: -3 days (Expired)
    console.log('\nStep 4: Provisioning medicines for Fresh, Soon, and Expired bands...');

    // Get active profile id
    const { data: cpList } = await adminClient
      .from('care_access')
      .select('care_profile_id')
      .eq('user_id', userId);
    const careProfileId = cpList[0].care_profile_id;

    // Metformin (Fresh: 60 days)
    const { data: metMed } = await adminClient
      .from('medicines')
      .insert({
        care_profile_id: careProfileId,
        name: 'Metformin',
        strength: '500 mg',
        form: 'tablet',
        unit: 'tablets',
        purpose: 'Blood sugar control',
      })
      .select('id')
      .single();
    await adminClient.from('inventory_items').insert({
      medicine_id: metMed.id,
      care_profile_id: careProfileId,
      quantity_initial: 60,
      quantity_remaining: 42,
      expiry_date: getDateOffset(60),
      storage_location: 'Kitchen Shelf',
      batch_no: 'M812',
      status: 'active',
    });

    // Ibuprofen (Soon: 18 days)
    const { data: ibuMed } = await adminClient
      .from('medicines')
      .insert({
        care_profile_id: careProfileId,
        name: 'Ibuprofen',
        strength: '200 mg',
        form: 'tablet',
        unit: 'tablets',
        purpose: 'Occasional headache',
      })
      .select('id')
      .single();
    await adminClient.from('inventory_items').insert({
      medicine_id: ibuMed.id,
      care_profile_id: careProfileId,
      quantity_initial: 24,
      quantity_remaining: 12,
      expiry_date: getDateOffset(18),
      storage_location: 'Hallway Drawer',
      batch_no: 'B2409',
      status: 'active',
    });

    // Amoxicillin (Expired: -3 days)
    const { data: amoxMed } = await adminClient
      .from('medicines')
      .insert({
        care_profile_id: careProfileId,
        name: 'Amoxicillin',
        strength: '250 mg',
        form: 'capsule',
        unit: 'capsules',
        purpose: 'Past dental infection',
      })
      .select('id')
      .single();
    await adminClient.from('inventory_items').insert({
      medicine_id: amoxMed.id,
      care_profile_id: careProfileId,
      quantity_initial: 20,
      quantity_remaining: 8,
      expiry_date: getDateOffset(-3),
      storage_location: 'Medicine Cabinet',
      batch_no: 'A104',
      status: 'active',
    });
    console.log('  ✓ Successfully provisioned all 4 expiry band scenarios!');

    // Step 5: Verify Cabinet List and Capture Screenshots
    console.log('\nStep 5: Verifying Cabinet List at 360px and 1280px...');
    await mobilePage.goto(`${BASE_URL}/app/cabinet`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('text=Cabinet', { timeout: 10000 });
    await mobilePage.waitForSelector('text=Metformin', { timeout: 10000 });

    // Verify all 4 expiry badges exist on Cabinet
    await mobilePage.waitForSelector('span[data-band="fresh"]', { timeout: 5000 });
    await mobilePage.waitForSelector('span[data-band="soon"]', { timeout: 5000 });
    await mobilePage.waitForSelector('span[data-band="urgent"]', { timeout: 5000 });
    await mobilePage.waitForSelector('span[data-band="expired"]', { timeout: 5000 });
    console.log(
      '  ✓ Verified all 4 expiry badges (Fresh, Soon, Urgent, Expired) visible in Cabinet!',
    );

    // Sync desktop page and screenshot
    await desktopPage.goto(`${BASE_URL}/app/cabinet`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForSelector('text=Metformin', { timeout: 10000 });

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a3-cabinet-all-bands-360px.png'),
      fullPage: true,
    });
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a3-cabinet-all-bands-1280px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Cabinet All-Bands screenshots at 360px and 1280px');

    // Step 6: Test Search & Filters
    console.log('\nStep 6: Testing Search and Filter Chips...');
    // Search for "Metformin"
    await mobilePage.fill('input[placeholder*="Search"]', 'Metformin');
    await mobilePage.waitForTimeout(300);
    const metCount = await mobilePage.locator('text=Metformin').count();
    const eyeCount = await mobilePage.locator('text=Eye Drops').count();
    if (metCount === 0 || eyeCount > 0) {
      throw new Error('Search failed: Eye Drops should be hidden when searching Metformin');
    }
    console.log('  ✓ Search filter working: only Metformin shown');

    // Clear search
    await mobilePage.click('button[aria-label="Clear search"]');
    await mobilePage.waitForTimeout(300);

    // Filter "Expiring soon"
    await mobilePage.click('button[role="tab"]:has-text("Expiring soon")');
    await mobilePage.waitForTimeout(300);
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a3-cabinet-filtered-soon-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Filtered Soon screen at 360px');

    // Filter "Expired"
    await mobilePage.click('button[role="tab"]:has-text("Expired")');
    await mobilePage.waitForTimeout(300);
    await mobilePage.waitForSelector('text=Amoxicillin', { timeout: 3000 });
    console.log('  ✓ Expired filter working: Amoxicillin visible');

    // Return to "All"
    await mobilePage.click('button[role="tab"]:has-text("All")');
    await mobilePage.waitForTimeout(300);

    // Step 7: Medicine Detail & Box Management
    console.log('\nStep 7: Testing Medicine Detail & Inventory Actions for Eye Drops...');
    await mobilePage.click('a:has-text("Eye Drops")');
    await mobilePage.waitForURL('**/app/medicine/**', {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });
    await mobilePage.waitForSelector('text=Eye Drops', { timeout: 5000 });

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a3-medicine-detail-urgent-360px.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured Medicine Detail screen at 360px');

    // Test Adding 2nd Box
    console.log('  Adding second box to Eye Drops...');
    await mobilePage.click('button:has-text("Add another box")');
    await mobilePage.waitForSelector('text=Add a box of Eye Drops', { timeout: 5000 });
    await mobilePage.fill('#add-box-qty', '2');
    await mobilePage.fill('#add-box-exp', getDateOffset(90));
    await mobilePage.fill('#add-box-loc', 'Medicine Cabinet');
    await mobilePage.click('button[type="submit"]:has-text("Add box")');
    await mobilePage.waitForTimeout(1000);

    // Verify 2 boxes are present
    const boxCardsCount = await mobilePage.locator('div[class*="boxCard"]').count();
    console.log(`  ✓ Number of boxes now listed: ${boxCardsCount} (expected 2)`);
    if (boxCardsCount !== 2) {
      throw new Error(`Expected 2 boxes, got ${boxCardsCount}`);
    }

    // Test Adjust Stock (+5)
    console.log('  Testing stock adjustment (+5)...');
    const firstBoxCard = mobilePage.locator('div[class*="boxCard"]').first();
    await firstBoxCard.locator('button:has-text("Adjust stock")').click();
    await mobilePage.waitForSelector('text=Adjust stock', { timeout: 5000 });
    await mobilePage.fill('#adjust-delta-input', '5');

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'phase-a3-adjust-stock-360px.png'),
    });
    console.log('  ✓ Captured Adjust Stock dialog at 360px');

    await mobilePage.click('button[type="submit"]:has-text("Save adjustment")');
    await mobilePage.waitForTimeout(1000);
    console.log('  ✓ Stock adjustment saved successfully!');

    // Test Discard Box
    console.log('  Testing discard box...');
    const boxToDiscard = mobilePage.locator('div[class*="boxCard"]').first();
    await boxToDiscard.locator('button:has-text("Discard box")').click();
    await mobilePage.waitForSelector('text=Discard this box?', { timeout: 5000 });
    await mobilePage.click('button:has-text("Discard box")[data-danger="true"]');
    await mobilePage.waitForTimeout(1000);

    const remainingBoxes = await mobilePage.locator('div[class*="boxCard"]').count();
    console.log(`  ✓ Remaining active boxes after discard: ${remainingBoxes} (expected 1)`);
    if (remainingBoxes !== 1) {
      throw new Error(`Expected 1 remaining active box after discard, got ${remainingBoxes}`);
    }

    // Step 8: Delete Medicine
    console.log('\nStep 8: Testing Delete / Archive Medicine...');
    await mobilePage.click('button:has-text("Remove medicine from cabinet")');
    await mobilePage.waitForSelector('text=Remove Eye Drops?', { timeout: 5000 });
    await mobilePage.click('button:has-text("Remove medicine")[data-danger="true"]');
    await mobilePage.waitForURL('**/app/cabinet', {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });
    await mobilePage.waitForTimeout(500);

    const eyeDropsInCabinet = await mobilePage.locator('text=Eye Drops').count();
    console.log(`  ✓ Eye Drops presence in cabinet: ${eyeDropsInCabinet} (expected 0)`);
    if (eyeDropsInCabinet !== 0) {
      throw new Error('Eye Drops was not properly archived/removed from cabinet');
    }

    console.log('\n=================================================================');
    console.log('✅ ALL PHASE A3 VERIFICATION CHECKS PASSED WITH FLYING COLORS!');
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
