import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load environment from .env.local if present
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

function findPsql() {
  const candidates = [
    'psql',
    'psql.exe',
    resolve(process.env.USERPROFILE || '', 'pgsql', 'bin', 'psql.exe'),
    resolve(process.env.LOCALAPPDATA || '', 'Programs', 'PostgreSQL', 'bin', 'psql.exe'),
    '/usr/local/bin/psql',
    '/usr/bin/psql',
    '/opt/homebrew/bin/psql',
  ];

  for (const candidate of candidates) {
    try {
      const res = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
      if (res.status === 0) {
        return candidate;
      }
    } catch {
      // continue
    }
  }
  return null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const refMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
const projectRef = refMatch ? refMatch[1] : '';
const host = process.env.DB_HOST || (projectRef ? `db.${projectRef}.supabase.co` : 'localhost');
const port = process.env.DB_PORT || (projectRef ? '5432' : '54322');
const user = process.env.DB_USER || 'postgres';
const database = process.env.DB_NAME || 'postgres';
const password = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || 'postgres';

console.log(`Resetting database on ${host}:${port}/${database}...`);

const psqlBin = findPsql();
if (!psqlBin) {
  console.error('Error: psql was not found in PATH or standard installation directories.');
  process.exit(1);
}

const env = { ...process.env, PGPASSWORD: password };

// 1. Cleanly recreate public schema and delete any test migration tracking
const resetSql = `
  drop schema public cascade;
  create schema public;
  grant usage on schema public to postgres, anon, authenticated, service_role;
  grant all on schema public to postgres, service_role;
  delete from auth.users where id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  );
  delete from supabase_migrations.schema_migrations;
`;

const resetRes = spawnSync(
  psqlBin,
  ['-h', host, '-p', port, '-U', user, '-d', database, '-c', resetSql.replace(/\n/g, ' ')],
  { env, encoding: 'utf8' }
);

if (resetRes.status !== 0) {
  console.error('Schema reset failed:', resetRes.stderr || resetRes.stdout);
  process.exit(resetRes.status || 1);
}

console.log('Public schema reset successfully. Applying migrations...');

// 2. Re-apply all migrations using supabase db push
const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';
const pushArgs = [
  'supabase',
  'db',
  'push',
  '--remote',
  projectRef,
  '--password',
  password,
  '--include-all',
  '--yes',
];

const pushRes = spawnSync(npxCmd, pushArgs, {
  env,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (pushRes.status !== 0) {
  console.error('Migration push failed:', pushRes.stderr || pushRes.stdout);
  process.exit(pushRes.status || 1);
}

console.log('Database reset and migrations applied cleanly.');
