import assert from 'node:assert';
import {
  urlBase64ToUint8Array,
  getDeviceInstallState,
} from '../src/features/notifications/push-utils.ts';

console.log('Testing Push & Device Installation Utility Functions...\n');

// 1. Test urlBase64ToUint8Array
console.log('1. Verifying urlBase64ToUint8Array...');
const sampleVapidKey =
  'BCvDoxO1b8sN2sI2i08u8k1g739R6e7f_J_K-L_M_N-O_P-Q_R_S-T_U-V_W-X_Y-Z0123456789abcdef';
const byteArray = urlBase64ToUint8Array(sampleVapidKey);
assert(byteArray instanceof Uint8Array, 'Output must be a Uint8Array');
assert(byteArray.length > 0, 'Uint8Array must not be empty');
console.log(
  `  ✓ Converted VAPID string (${sampleVapidKey.length} chars) to Uint8Array (${byteArray.length} bytes)`,
);

// 2. Test getDeviceInstallState with mock user agents
console.log('\n2. Verifying getDeviceInstallState...');

// A. iOS Safari User Agent (iPhone)
const iosSafariUA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';

// Setup minimal global mock for test runner
globalThis.window = {
  navigator: {},
  matchMedia: () => ({ matches: false }),
};

const iosState = getDeviceInstallState(iosSafariUA);
assert.strictEqual(iosState.isIos, true, 'Must identify iPhone as iOS');
assert.strictEqual(iosState.isIosSafari, true, 'Must identify Safari on iPhone');
assert.strictEqual(iosState.isAndroid, false, 'Must not be Android');
assert.strictEqual(iosState.needsIosInstallForPush, true, 'iOS browser needs install for push');
console.log('  ✓ iOS Safari browser correctly detected (needs home screen install for push)');

// B. iOS Standalone (Installed PWA)
globalThis.window.matchMedia = (query) => ({ matches: query.includes('standalone') });
const iosStandaloneState = getDeviceInstallState(iosSafariUA);
assert.strictEqual(iosStandaloneState.isStandalone, true, 'Must identify standalone display mode');
assert.strictEqual(
  iosStandaloneState.needsIosInstallForPush,
  false,
  'Installed iOS does not need install',
);
console.log('  ✓ Installed iOS PWA correctly detected (ready for push)');

// C. Android Chrome User Agent
globalThis.window.matchMedia = () => ({ matches: false });
const androidChromeUA =
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36';
const androidState = getDeviceInstallState(androidChromeUA);
assert.strictEqual(androidState.isAndroid, true, 'Must identify Android');
assert.strictEqual(androidState.isIos, false, 'Must not be iOS');
assert.strictEqual(
  androidState.needsIosInstallForPush,
  false,
  'Android does not need iOS install step',
);
console.log('  ✓ Android device correctly detected');

// D. Desktop Windows Chrome User Agent
const desktopUA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';
const desktopState = getDeviceInstallState(desktopUA);
assert.strictEqual(desktopState.isIos, false, 'Desktop is not iOS');
assert.strictEqual(desktopState.isAndroid, false, 'Desktop is not Android');
assert.strictEqual(
  desktopState.needsIosInstallForPush,
  false,
  'Desktop does not need iOS install step',
);
console.log('  ✓ Desktop device correctly detected');

console.log('\n=================================================================');
console.log('✅ ALL PUSH & INSTALL UTILITY TESTS PASSED!');
console.log('=================================================================\n');
