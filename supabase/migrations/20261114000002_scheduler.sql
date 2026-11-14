-- MedBuddy Migration 3: Scheduler (pg_cron & pg_net)
-- Enables pg_cron and pg_net and schedules the 5 recurring background maintenance jobs.
-- Safe to run multiple times (idempotent).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Unschedule existing jobs if already present to guarantee idempotency
do $$
declare
  j record;
begin
  for j in
    select jobid from cron.job
    where jobname in (
      'medbuddy-enqueue-due',
      'medbuddy-send',
      'medbuddy-generate-doses',
      'medbuddy-expiry',
      'medbuddy-cleanup'
    )
  loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- 1. medbuddy-enqueue-due: runs every minute to queue due, renudge, and missed dose notifications
select cron.schedule(
  'medbuddy-enqueue-due',
  '* * * * *',
  'select fn_enqueue_due_notifications();'
);

-- 2. medbuddy-send: runs every minute to trigger the send-notifications Edge Function
-- Securely reads x-cron-secret from Supabase Vault (never hardcoded)
select cron.schedule(
  'medbuddy-send',
  '* * * * *',
  $$
  select
    net.http_post(
      url := 'https://fenqdaymgofxozjgcppt.supabase.co/functions/v1/send-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', s.decrypted_secret
      ),
      body := '{}'::jsonb
    )
  from vault.decrypted_secrets s
  where s.name = 'cron_secret'
  limit 1;
  $$
);

-- 3. medbuddy-generate-doses: runs daily at 00:05 to pre-generate 7 days of upcoming dose events
select cron.schedule(
  'medbuddy-generate-doses',
  '5 0 * * *',
  'select fn_generate_dose_events(7);'
);

-- 4. medbuddy-expiry: runs daily at 04:00 to queue medicine expiry and low-stock warnings
select cron.schedule(
  'medbuddy-expiry',
  '0 4 * * *',
  'select fn_enqueue_expiry_notifications();'
);

-- 5. medbuddy-cleanup: runs daily at 03:00 to purge notifications older than 30 days
select cron.schedule(
  'medbuddy-cleanup',
  '0 3 * * *',
  'delete from notifications where created_at < now() - interval ''30 days'';'
);
