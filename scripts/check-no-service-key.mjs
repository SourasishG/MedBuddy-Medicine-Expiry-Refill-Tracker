#!/usr/bin/env node

/**
 * scripts/check-no-service-key.mjs
 *
 * Security guard to verify that SUPABASE_SERVICE_ROLE_KEY is never
 * imported, referenced, or bundled anywhere under src/ or in .next/static/.
 *
 * The service role key bypasses PostgreSQL Row Level Security (RLS) and must
 * strictly remain in Edge Functions and administrative scripts only.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');
const NEXT_STATIC_DIR = join(process.cwd(), '.next', 'static');

const FORBIDDEN_PATTERNS = [
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY identifier',
    regex: /SUPABASE_SERVICE_ROLE_KEY/i,
  },
  {
    name: 'service_role key reference',
    regex: /service_role.*key|serviceRoleKey/i,
  },
];

function getAllFiles(dir, fileList = []) {
  if (!existsSync(dir)) return fileList;
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

let violations = 0;

console.log('--- Checking src/ for forbidden service role key references ---');
const srcFiles = getAllFiles(SRC_DIR);
console.log(`Auditing ${srcFiles.length} files under src/...`);

for (const file of srcFiles) {
  // Only check code/asset files
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss)$/i.test(file)) continue;

  const content = readFileSync(file, 'utf-8');
  for (const { name, regex } of FORBIDDEN_PATTERNS) {
    if (regex.test(content)) {
      console.error(`[VIOLATION] ${file}: Found ${name}`);
      violations++;
    }
  }
}

if (existsSync(NEXT_STATIC_DIR)) {
  console.log('\n--- Checking .next/static/ client bundle for leaked secrets ---');
  const bundleFiles = getAllFiles(NEXT_STATIC_DIR).filter((f) => /\.(js|css|json)$/i.test(f));
  console.log(`Auditing ${bundleFiles.length} compiled client bundle files...`);

  for (const file of bundleFiles) {
    const content = readFileSync(file, 'utf-8');
    for (const { name, regex } of FORBIDDEN_PATTERNS) {
      if (regex.test(content)) {
        console.error(`[BUNDLE VIOLATION] ${file}: Found ${name}`);
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\nFAILED: Found ${violations} forbidden service role reference(s).`);
  process.exit(1);
}

console.log('\nPASSED: Zero service role key references found in src/ or client bundles.');
process.exit(0);
