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

const psqlBin = findPsql();
if (!psqlBin) {
  console.error('Error: psql was not found in PATH or standard installation directories.');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const refMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
const projectRef = refMatch ? refMatch[1] : '';
const host = process.env.DB_HOST || (projectRef ? `db.${projectRef}.supabase.co` : 'localhost');
const port = process.env.DB_PORT || (projectRef ? '5432' : '54322');
const user = process.env.DB_USER || 'postgres';
const database = process.env.DB_NAME || 'postgres';
const password = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || 'postgres';

const env = { ...process.env, PGPASSWORD: password };

const cleanupSql = `
  drop function if exists assert(boolean, text) cascade;
  delete from care_profiles where exists (
    select 1 from care_access ca
    where ca.care_profile_id = care_profiles.id
      and ca.user_id in (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333'
      )
  );
  delete from auth.users where id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  );
`;

function runPsqlCommand(sql) {
  return spawnSync(
    psqlBin,
    ['-h', host, '-p', port, '-U', user, '-d', database, '-c', sql.replace(/\n/g, ' ')],
    { env, encoding: 'utf8' }
  );
}

// Clean up any test remnants from prior runs
runPsqlCommand(cleanupSql);

console.log(`Running database scenario tests via psql against ${host}:${port}/${database}...`);

const testFiles = [
  { name: 'Schema Scenario', path: resolve(process.cwd(), 'supabase/tests/schema_scenario.sql') },
  { name: 'Review Fixes Scenario', path: resolve(process.cwd(), 'supabase/tests/review_fixes_scenario.sql') },
];

for (const tf of testFiles) {
  console.log(`\n--- Running ${tf.name} ---`);
  const res = spawnSync(
    psqlBin,
    ['-h', host, '-p', port, '-U', user, '-d', database, '-v', 'ON_ERROR_STOP=1', '-f', tf.path],
    {
      env,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (res.stdout) {
    const lines = res.stdout.split('\n');
    for (const line of lines) {
      if (
        line.startsWith('==') ||
        line.startsWith('ALL TESTS') ||
        line.startsWith('ALL REVIEW') ||
        line.includes('ok)') ||
        line.includes('✓') ||
        line.startsWith('FAIL:')
      ) {
        console.log(line);
      }
    }
  }

  // Clean up test remnants after each run
  runPsqlCommand(cleanupSql);

  if (res.status !== 0) {
    console.error(`\n${tf.name} failed with exit code:`, res.status);
    if (res.stderr) console.error(res.stderr);
    process.exit(res.status || 1);
  }
}

console.log('\nAll database test scenarios completed successfully.');
