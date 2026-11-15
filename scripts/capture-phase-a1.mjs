import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Sourasish/.gemini/antigravity/brain/d2b0a0e6-7e7e-45cf-bbdb-d659180f7dc1';
const BASE_URL = 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({ channel: 'chrome' });

  // 1. Mobile (360 x 780)
  const mobileContext = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const mobilePage = await mobileContext.newPage();

  // 2. Desktop (1280 x 850)
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const desktopPage = await desktopContext.newPage();

  console.log('Capturing sign-in screen...');
  await mobilePage.goto(`${BASE_URL}/app/sign-in`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'phase-a1-sign-in-360px.png'), fullPage: true });

  await desktopPage.goto(`${BASE_URL}/app/sign-in`, { waitUntil: 'networkidle' });
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'phase-a1-sign-in-1280px.png'), fullPage: true });

  console.log('Capturing sign-in OTP step...');
  await mobilePage.fill('#email-input', 'test@example.com');
  // Type email and submit to transition to OTP UI
  // Instead of triggering real Supabase OTP network call, we can trigger the UI step or test real
  // Let's test with a simulated action or click
  // Actually, we can click "Email me a code" or simulate state
  console.log('Capturing consent screen...');
  await mobilePage.goto(`${BASE_URL}/app/consent`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'phase-a1-consent-360px.png'), fullPage: true });

  await desktopPage.goto(`${BASE_URL}/app/consent`, { waitUntil: 'networkidle' });
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'phase-a1-consent-1280px.png'), fullPage: true });

  console.log('Capturing setup screen...');
  await mobilePage.goto(`${BASE_URL}/app/setup`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'phase-a1-setup-360px.png'), fullPage: true });

  await desktopPage.goto(`${BASE_URL}/app/setup`, { waitUntil: 'networkidle' });
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'phase-a1-setup-1280px.png'), fullPage: true });

  console.log('Capturing app privacy notice...');
  await mobilePage.goto(`${BASE_URL}/app/privacy`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'phase-a1-privacy-360px.png'), fullPage: true });

  await desktopPage.goto(`${BASE_URL}/app/privacy`, { waitUntil: 'networkidle' });
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'phase-a1-privacy-1280px.png'), fullPage: true });

  await mobileContext.close();
  await desktopContext.close();
  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exitCode = 1;
});
