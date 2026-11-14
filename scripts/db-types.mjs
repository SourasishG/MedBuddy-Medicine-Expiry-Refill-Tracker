import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load environment from .env.local if present
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // fallback parser
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

function getDbUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const dbPass = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const refMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = refMatch ? refMatch[1] : '';

  if (dbPass && projectRef) {
    const encoded = encodeURIComponent(dbPass);
    return `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres`;
  }
  return null;
}

const dbUrl = getDbUrl();
const targetFile = resolve(process.cwd(), 'src/lib/supabase/database.types.ts');
console.log('Generating Supabase TypeScript types into:', targetFile);

const args = ['supabase', 'gen', 'types', 'typescript', '--schema', 'public'];
if (dbUrl) {
  args.push('--remote', dbUrl);
} else {
  args.push('--local');
}

const cmdString = `npx ${args.map((a) => `"${a}"`).join(' ')}`;
const res = spawnSync(cmdString, {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
  shell: true,
});

if (res.status !== 0) {
  console.error('Failed to generate types:', res.stderr || res.stdout);
  process.exit(res.status || 1);
}

// Strip out any non-TypeScript notices (e.g. "Target: custom Postgres...")
let output = res.stdout;
const typeDefStart = output.indexOf('export type');
if (typeDefStart !== -1) {
  output = output.substring(typeDefStart);
}

writeFileSync(targetFile, output, 'utf8');
console.log('Successfully generated database.types.ts (' + output.split('\n').length + ' lines).');
