import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const swPath = resolve(process.cwd(), 'public/sw.js');

if (!existsSync(swPath)) {
  console.error('❌ Service worker file public/sw.js not found. Run `npm run build` first.');
  process.exit(1);
}

const content = readFileSync(swPath, 'utf8');

console.log('=== Service Worker Privacy & Caching Audit ===\n');

// 1. Verify defaultCache is completely removed
assert(
  !content.includes('defaultCache'),
  'defaultCache must not be present in service worker bundle',
);
console.log('✓ Verified: defaultCache is completely absent');

// 2. Extract runtimeCaching section from minified bundle
const match = content.match(/runtimeCaching:\s*(\[[^\]]+\])/);
assert(match, 'runtimeCaching array must be present in service worker bundle');
const runtimeCachingBlock = match[1];

// 3. Prohibited caching target checks in runtimeCaching rules
const prohibitedTargets = [
  { name: 'Supabase Host (*.supabase.co)', pattern: /supabase\.co/i },
  { name: 'Auth Endpoints (/auth/)', pattern: /startsWith\(['"]\/auth\//i },
  { name: 'REST Endpoints (/rest/)', pattern: /startsWith\(['"]\/rest\//i },
  { name: 'Functions Endpoints (/functions/)', pattern: /startsWith\(['"]\/functions\//i },
  { name: 'API Endpoints (/api/)', pattern: /startsWith\(['"]\/api\//i },
];

let violations = 0;
for (const check of prohibitedTargets) {
  // If a rule specifically matches a sensitive path to CACHE it (e.g. pathname.startsWith('/auth/'))
  // inside the matcher without the exclusion check
  const matcherHasTarget = check.pattern.test(runtimeCachingBlock);
  if (matcherHasTarget) {
    console.error(
      `❌ VIOLATION: Found affirmative caching rule for sensitive target: ${check.name}`,
    );
    violations++;
  } else {
    console.log(`✓ Verified: No caching rule for ${check.name}`);
  }
}

// 4. Verify Authorization header and sameOrigin exclusion guards exist
const hasAuthHeaderGuard = content.includes('Authorization');
assert(
  hasAuthHeaderGuard,
  'Service worker must explicitly check and exclude Authorization headers',
);
console.log('✓ Verified: Authorization header exclusion guard is present');

const hasSameOriginGuard = content.includes('sameOrigin');
assert(hasSameOriginGuard, 'Service worker must explicitly verify sameOrigin');
console.log('✓ Verified: sameOrigin security guard is present');

// 5. Precached route verification
const hasOfflinePrecache = content.includes('/offline');
assert(hasOfflinePrecache, 'Service worker must precache /offline document fallback');
console.log('✓ Verified: Precache includes /offline');

const hasAppPrecache = content.includes('/app');
assert(hasAppPrecache, 'Service worker must precache /app shell');
console.log('✓ Verified: Precache includes /app');

if (violations === 0) {
  console.log('\n=================================================================');
  console.log('SERVICE WORKER AUDIT PASSED: ZERO PRIVATE DATA CACHING RULES');
  console.log('=================================================================');
  process.exit(0);
} else {
  console.error(`\n❌ Service worker failed audit with ${violations} violation(s).`);
  process.exit(1);
}
