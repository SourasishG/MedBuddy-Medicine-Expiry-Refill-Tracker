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

// 1. Prohibited caching pattern checks
const forbiddenPatterns = [
  { name: 'Supabase Host (supabase.co)', pattern: /cache.*supabase\.co/i },
  { name: 'Auth Endpoints (/auth/)', pattern: /cache.*\/auth\//i },
  { name: 'REST Endpoints (/rest/)', pattern: /cache.*\/rest\//i },
  { name: 'Edge Function Endpoints (/functions/)', pattern: /cache.*\/functions\//i },
  { name: 'API Endpoints (/api/)', pattern: /cache.*\/api\//i },
];

let violations = 0;
for (const check of forbiddenPatterns) {
  if (check.pattern.test(content)) {
    console.error(`❌ VIOLATION: Found caching rule for sensitive target: ${check.name}`);
    violations++;
  } else {
    console.log(`✓ Verified: No caching rule for ${check.name}`);
  }
}

// 2. Precached route verification
const hasOfflinePrecache = content.includes('/offline');
const hasAppPrecache = content.includes('/app');

assert(hasOfflinePrecache, 'Service worker must precache /offline document fallback');
console.log('✓ Verified: Precache includes /offline');

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
