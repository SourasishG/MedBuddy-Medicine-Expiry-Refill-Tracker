import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR =
  'C:/Users/Sourasish/.gemini/antigravity/brain/d2b0a0e6-7e7e-45cf-bbdb-d659180f7dc1';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  const contextMobile = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const pageMobile = await contextMobile.newPage();
  await pageMobile.goto('http://localhost:3000/app/sign-in?step=otp&email=sarah%40example.com', {
    waitUntil: 'domcontentloaded',
  });
  await pageMobile.waitForSelector('#otp-input');
  await pageMobile.fill('#otp-input', '842910');
  await pageMobile.screenshot({
    path: path.join(ARTIFACT_DIR, 'phase-a1-sign-in-otp-360px.png'),
    fullPage: true,
  });

  const contextDesktop = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const pageDesktop = await contextDesktop.newPage();
  await pageDesktop.goto('http://localhost:3000/app/sign-in?step=otp&email=sarah%40example.com', {
    waitUntil: 'domcontentloaded',
  });
  await pageDesktop.waitForSelector('#otp-input');
  await pageDesktop.fill('#otp-input', '842910');
  await pageDesktop.screenshot({
    path: path.join(ARTIFACT_DIR, 'phase-a1-sign-in-otp-1280px.png'),
    fullPage: true,
  });

  await browser.close();
  console.log('✓ Captured OTP input screenshots at 360px and 1280px successfully!');
}

main().catch(console.error);
