import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------
// Load Environment Variables
// ---------------------------------------------------------------------
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=================================================================');
  console.log('MEDBUDDY SCHEDULER & BACKEND HEALTH CHECK');
  console.log(`Target: ${supabaseUrl}`);
  console.log('=================================================================\n');

  const { data, error } = await adminClient.rpc('fn_scheduler_health');

  if (error) {
    console.error('❌ Failed to call fn_scheduler_health RPC:');
    console.error(`  Code: ${error.code}`);
    console.error(`  Message: ${error.message}`);
    console.log('\n=================================================================');
    console.log('VERDICT: UNHEALTHY (Failed to invoke database health routine)');
    console.log('=================================================================');
    process.exit(1);
  }

  const issues = [];

  // 1. Vault Secrets Check
  console.log('[1. Vault Secrets]');
  const hasCron = Boolean(data.vault?.has_cron_secret);
  const hasUrl = Boolean(data.vault?.has_project_url);

  console.log(`  - cron_secret:  ${hasCron ? '✓ Present' : '❌ MISSING'}`);
  console.log(`  - project_url:  ${hasUrl ? '✓ Present' : '❌ MISSING'}`);

  if (!hasCron) issues.push('Vault secret "cron_secret" is missing from Supabase Vault.');
  if (!hasUrl) issues.push('Vault secret "project_url" is missing from Supabase Vault.');

  // 2. Cron Jobs Check
  console.log('\n[2. Cron Jobs Status]');
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  if (jobs.length === 0) {
    console.log('  ⚠️ No active medbuddy-* jobs found in cron.job');
    issues.push('No medbuddy-* jobs registered in pg_cron.');
  } else {
    for (const job of jobs) {
      const status = job.status || 'pending_first_run';
      const timeStr = job.start_time ? new Date(job.start_time).toLocaleString() : 'N/A';
      const isFailed = status === 'failed';
      const mark = isFailed ? '❌' : status === 'succeeded' ? '✓' : 'ℹ️';
      console.log(`  ${mark} ${job.jobname.padEnd(25)} : ${status.padEnd(12)} (Last run: ${timeStr})`);
      if (isFailed) {
        issues.push(`Cron job "${job.jobname}" failed on last run. Details: ${job.return_message || 'None'}`);
      }
    }
  }

  // 3. Notification Pipeline Check
  console.log('\n[3. Notification Queue & Pipeline]');
  const pendingLag = Number(data.notifications?.pending_lagging_over_5m || 0);
  const failed24h = Number(data.notifications?.failed_last_24h || 0);
  const lastSent = data.notifications?.last_sent_at;

  console.log(`  - Overdue notifications (>5m lag): ${pendingLag === 0 ? '✓ 0' : `⚠️ ${pendingLag} delayed`}`);
  console.log(`  - Failed notifications (last 24h): ${failed24h === 0 ? '✓ 0' : `⚠️ ${failed24h} failed`}`);
  console.log(`  - Last successful notification:   ${lastSent ? new Date(lastSent).toLocaleString() : 'None in history'}`);

  if (pendingLag > 0) {
    issues.push(`${pendingLag} notifications are pending more than 5 minutes past send_after.`);
  }

  // Final Verdict
  console.log('\n=================================================================');
  if (issues.length === 0) {
    console.log('VERDICT: OK');
    console.log('All Vault secrets present, jobs running normally, notification pipeline healthy.');
    console.log('=================================================================');
    process.exit(0);
  } else {
    console.log('VERDICT: UNHEALTHY / DEGRADED');
    console.log('The following issues were detected:');
    for (const issue of issues) {
      console.log(`  ❌ ${issue}`);
    }
    console.log('=================================================================');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Unhandled exception during health check:', err);
  process.exit(1);
});
