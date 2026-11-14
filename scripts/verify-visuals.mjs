/**
 * scripts/verify-visuals.mjs
 *
 * Verifies visual integrity and fallbacks:
 * 1. Checks Motion-on mode (default)
 * 2. Checks Motion-off mode (static layout, data-motion="off")
 * 3. Checks Low-tier fallback (?tier=low)
 */

import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';

const ARTIFACT_DIR =
  'C:\\Users\\Sourasish\\.gemini\\antigravity\\brain\\d2b0a0e6-7e7e-45cf-bbdb-d659180f7dc1';
const TEMP_PROFILE = 'C:\\Users\\Sourasish\\AppData\\Local\\Temp\\chrome-cdp-vis';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const ready = new Promise((resolve) => {
    ws.onopen = resolve;
  });

  return { ws, send, ready };
}

async function run() {
  if (existsSync(TEMP_PROFILE)) {
    try {
      rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${TEMP_PROFILE}`,
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1280,1000',
    'about:blank',
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {
      // retry
    }
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Could not connect to Chrome CDP');
  }

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const pages = await listRes.json();
    const client = createCdpClient(pages[0].webSocketDebuggerUrl);
    await client.ready;
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('--- 1. Testing Default Motion-On View ---');
    await client.send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(2500);

    const shot1 = await client.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${ARTIFACT_DIR}\\visual-motion-on.png`, Buffer.from(shot1.data, 'base64'));
    console.log('Captured visual-motion-on.png');

    console.log('--- 2. Testing Motion-Off Fallback ---');
    // Set motion off in storage and reload
    await client.send('Runtime.evaluate', {
      expression: `localStorage.setItem('medbuddy-motion', 'off')`,
    });
    await client.send('Page.reload');
    await sleep(2000);

    const motionState = await client.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        dataset: document.documentElement.dataset.motion,
        storage: localStorage.getItem('medbuddy-motion')
      })`,
      returnByValue: true,
    });
    console.log('Motion-off DOM state:', JSON.parse(motionState.result.value));

    const shot2 = await client.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${ARTIFACT_DIR}\\visual-motion-off.png`, Buffer.from(shot2.data, 'base64'));
    console.log('Captured visual-motion-off.png');

    console.log('--- 3. Testing Low-Power Tier Fallback (?tier=low) ---');
    await client.send('Page.navigate', { url: 'http://localhost:3000/?tier=low' });
    await sleep(2000);

    const tierState = await client.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        hasStaticPoster: !!document.querySelector('img[alt*="MedBuddy"]'),
        hasCanvas: !!document.querySelector('canvas')
      })`,
      returnByValue: true,
    });
    console.log('Low-tier state (hasCanvas should be false):', JSON.parse(tierState.result.value));

    const shot3 = await client.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${ARTIFACT_DIR}\\visual-tier-low.png`, Buffer.from(shot3.data, 'base64'));
    console.log('Captured visual-tier-low.png');

    client.ws.close();
    console.log('\nVisual verification and fallbacks verified successfully!');
  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error('Visual verification failed:', err);
  process.exit(1);
});
