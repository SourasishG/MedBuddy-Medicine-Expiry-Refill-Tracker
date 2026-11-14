/**
 * scripts/verify-phase-f3.mjs
 *
 * Automated verification of Phase F3:
 * 1. Spawns an isolated headless Chrome process with DevTools Protocol (CDP)
 * 2. Navigates to http://localhost:3000/privacy and captures privacy-table.png
 * 3. Navigates to http://localhost:3000/ and tests Motion toggle persistence:
 *    - Default state
 *    - Click toggle -> 'off'
 *    - localStorage verification
 *    - Reload -> persists 'off'
 *    - Open new tab -> persists 'off'
 *    - Click toggle -> 'on'
 *    - Reload -> persists 'on'
 * 4. Cleans up Chrome process cleanly
 */

import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';

const ARTIFACT_PATH =
  'C:\\Users\\Sourasish\\.gemini\\antigravity\\brain\\d2b0a0e6-7e7e-45cf-bbdb-d659180f7dc1\\privacy-table.png';
const TEMP_PROFILE = 'C:\\Users\\Sourasish\\AppData\\Local\\Temp\\chrome-cdp-f3';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();
  const eventListeners = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    } else if (data.method && eventListeners.has(data.method)) {
      for (const listener of eventListeners.get(data.method)) {
        listener(data.params);
      }
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const on = (method, cb) => {
    if (!eventListeners.has(method)) eventListeners.set(method, []);
    eventListeners.get(method).push(cb);
  };

  const ready = new Promise((resolve) => {
    ws.onopen = resolve;
  });

  return { ws, send, on, ready };
}

async function run() {
  console.log('=== Step 1: Launching Isolated Headless Chrome ===');
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
    '--window-size=1280,900',
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
    throw new Error('Failed to connect to headless Chrome on port 9222');
  }

  console.log('Headless Chrome is ready:', versionData.Browser);

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const pages = await listRes.json();
    const mainTarget = pages[0];

    const client = createCdpClient(mainTarget.webSocketDebuggerUrl);
    await client.ready;

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    console.log('\n=== Step 2: Navigating to Privacy Page & Capturing Table Screenshot ===');
    await client.send('Page.navigate', { url: 'http://localhost:3000/privacy' });
    await sleep(1500);

    // Scroll table into view
    await client.send('Runtime.evaluate', {
      expression: `
        const el = document.querySelector('table');
        if (el) el.scrollIntoView({ block: 'center' });
      `,
    });
    await sleep(500);

    // Capture screenshot of the table area
    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
    });

    const imgBuffer = Buffer.from(screenshot.data, 'base64');
    writeFileSync(ARTIFACT_PATH, imgBuffer);
    console.log(`Saved screenshot (${imgBuffer.length} bytes) to:\n  ${ARTIFACT_PATH}`);

    console.log('\n=== Step 3: Navigating to Home Page (http://localhost:3000/) ===');
    await client.send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(2000);

    const evalInitial = await client.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        storage: localStorage.getItem('medbuddy-motion'),
        dataset: document.documentElement.dataset.motion,
        btnText: document.querySelector('header button[aria-pressed]')?.innerText?.replace(/\\s+/g, ' ').trim() || 'NOT_FOUND'
      })`,
      returnByValue: true,
    });
    const initial = JSON.parse(evalInitial.result.value);
    console.log('Initial State:', initial);

    console.log('\n=== Step 4: Clicking Motion Toggle to turn OFF ===');
    await client.send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('header button[aria-pressed]');
        if (btn) btn.click();
      `,
    });
    await sleep(500);

    const evalToggledOff = await client.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        storage: localStorage.getItem('medbuddy-motion'),
        dataset: document.documentElement.dataset.motion,
        btnText: document.querySelector('header button[aria-pressed]')?.innerText?.replace(/\\s+/g, ' ').trim() || 'NOT_FOUND'
      })`,
      returnByValue: true,
    });
    const toggledOff = JSON.parse(evalToggledOff.result.value);
    console.log('Toggled Off State:', toggledOff);
    if (toggledOff.storage !== 'off' || toggledOff.dataset !== 'off') {
      throw new Error(`Expected storage and dataset to be 'off', got: ${JSON.stringify(toggledOff)}`);
    }

    console.log('\n=== Step 5: Reloading Page to verify persistence ===');
    await client.send('Page.reload');
    await sleep(1500);

    const evalReloaded = await client.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        storage: localStorage.getItem('medbuddy-motion'),
        dataset: document.documentElement.dataset.motion,
        btnText: document.querySelector('header button[aria-pressed]')?.innerText?.replace(/\\s+/g, ' ').trim() || 'NOT_FOUND'
      })`,
      returnByValue: true,
    });
    const reloaded = JSON.parse(evalReloaded.result.value);
    console.log('After Reload State:', reloaded);
    if (reloaded.storage !== 'off' || reloaded.dataset !== 'off') {
      throw new Error(
        `Persistence failed after reload: expected 'off', got ${JSON.stringify(reloaded)}`
      );
    }

    console.log('\n=== Step 6: Opening NEW Tab to verify cross-tab persistence ===');
    const newTargetRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:3000/privacy', {
      method: 'PUT',
    });
    const newTarget = await newTargetRes.json();
    const client2 = createCdpClient(newTarget.webSocketDebuggerUrl);
    await client2.ready;
    await client2.send('Page.enable');
    await client2.send('Runtime.enable');
    await sleep(1500);

    const evalNewTab = await client2.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        storage: localStorage.getItem('medbuddy-motion'),
        dataset: document.documentElement.dataset.motion
      })`,
      returnByValue: true,
    });
    const newTab = JSON.parse(evalNewTab.result.value);
    console.log('New Tab State:', newTab);
    if (newTab.storage !== 'off' || newTab.dataset !== 'off') {
      throw new Error(
        `Cross-tab persistence failed: expected 'off', got ${JSON.stringify(newTab)}`
      );
    }

    client2.ws.close();
    await fetch(`http://127.0.0.1:9222/json/close/${newTarget.id}`, { method: 'PUT' });

    console.log('\n=== Step 7: Toggling back to ON ===');
    await client.send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('header button[aria-pressed]');
        if (btn) btn.click();
      `,
    });
    await sleep(500);

    const evalToggledOn = await client.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        storage: localStorage.getItem('medbuddy-motion'),
        dataset: document.documentElement.dataset.motion,
        btnText: document.querySelector('header button[aria-pressed]')?.innerText?.replace(/\\s+/g, ' ').trim() || 'NOT_FOUND'
      })`,
      returnByValue: true,
    });
    const toggledOn = JSON.parse(evalToggledOn.result.value);
    console.log('Toggled Back ON State:', toggledOn);
    if (toggledOn.storage !== 'on' || toggledOn.dataset !== 'on') {
      throw new Error(
        `Expected storage and dataset to be 'on', got: ${JSON.stringify(toggledOn)}`
      );
    }

    await client.send('Page.reload');
    await sleep(1500);

    const evalReloadedOn = await client.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        storage: localStorage.getItem('medbuddy-motion'),
        dataset: document.documentElement.dataset.motion,
        btnText: document.querySelector('header button[aria-pressed]')?.innerText?.replace(/\\s+/g, ' ').trim() || 'NOT_FOUND'
      })`,
      returnByValue: true,
    });
    const reloadedOn = JSON.parse(evalReloadedOn.result.value);
    console.log('After Second Reload State:', reloadedOn);
    if (reloadedOn.storage !== 'on' || reloadedOn.dataset !== 'on') {
      throw new Error(
        `Persistence failed after second reload: expected 'on', got ${JSON.stringify(reloadedOn)}`
      );
    }

    client.ws.close();

    console.log('\n======================================================');
    console.log('ALL PHASE F3 AUTOMATED VERIFICATIONS PASSED CLEANLY!');
    console.log('======================================================');
  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
