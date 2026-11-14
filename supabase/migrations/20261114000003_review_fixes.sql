-- =====================================================================
-- MedBuddy Migration 4: Review Fixes
-- 1. Push subscription failure tracking, cool-down, and recovery
-- 2. Scheduler health function (fn_scheduler_health)
-- 3. Dynamic project_url lookup in scheduler and explicit failure handling
-- 4. Search path hardening on is_valid_tz and trg_inventory_init
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Push Subscriptions: Failure Tracking & Recovery (Issue 1)
-- ---------------------------------------------------------------------

alter table push_subscriptions
  add column if not exists first_failure_at timestamptz,
  add column if not exists last_failure_at timestamptz;

-- Record push failure: increment failure_count, update timestamps, delete if failing > 7 days
create or replace function fn_record_push_failure(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first timestamptz;
begin
  select coalesce(first_failure_at, now()) into v_first
    from push_subscriptions
   where id = p_id;

  if not found then
    return false;
  end if;

  -- Delete subscription if first failure was > 7 days ago and still failing
  if v_first < now() - interval '7 days' then
    delete from push_subscriptions where id = p_id;
    return false;
  end if;

  update push_subscriptions
     set failure_count = failure_count + 1,
         last_failure_at = now(),
         first_failure_at = v_first
   where id = p_id;

  return true;
end;
$$;

revoke all on function fn_record_push_failure(uuid) from public, anon, authenticated;
grant execute on function fn_record_push_failure(uuid) to service_role;

-- Record push success: reset failure counter, clear failure timestamps, set last_success_at
create or replace function fn_record_push_success(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update push_subscriptions
     set failure_count = 0,
         first_failure_at = null,
         last_failure_at = null,
         last_success_at = now()
   where id = p_id;
end;
$$;

revoke all on function fn_record_push_success(uuid) from public, anon, authenticated;
grant execute on function fn_record_push_success(uuid) to service_role;

-- Eligible push subscriptions view:
-- A subscription is eligible if failure_count < 5 OR cooled down for > 1 hour
-- (and first_failure_at is not older than 7 days)
create or replace view eligible_push_subscriptions
with (security_invoker = true)
as
  select *
    from push_subscriptions
   where (failure_count < 5 or last_failure_at < now() - interval '1 hour')
     and (first_failure_at is null or first_failure_at >= now() - interval '7 days');

revoke all on eligible_push_subscriptions from public, anon;
grant select on eligible_push_subscriptions to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Scheduler Health Function (Issue 2)
-- ---------------------------------------------------------------------

create or replace function fn_scheduler_health()
returns jsonb
language plpgsql
security definer
set search_path = public, vault, cron
as $$
declare
  v_has_cron_secret boolean;
  v_has_project_url boolean;
  v_jobs jsonb;
  v_pending_lagging bigint;
  v_failed_24h bigint;
  v_last_sent_at timestamptz;
begin
  -- 1. Vault secrets presence check (booleans only, never values)
  select exists(select 1 from vault.decrypted_secrets where name = 'cron_secret') into v_has_cron_secret;
  select exists(select 1 from vault.decrypted_secrets where name = 'project_url') into v_has_project_url;

  -- 2. Last status and execution time of each medbuddy-* job
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'jobname', j.jobname,
      'status', d.status,
      'start_time', d.start_time,
      'return_message', d.return_message
    ) order by j.jobname
  ), '[]'::jsonb)
  into v_jobs
  from cron.job j
  left join lateral (
    select r.status, r.start_time, r.return_message
      from cron.job_run_details r
     where r.jobid = j.jobid
     order by r.start_time desc
     limit 1
  ) d on true
  where j.jobname like 'medbuddy-%';

  -- 3. Notifications pending more than 5 minutes past send_after
  select count(*) into v_pending_lagging
    from notifications
   where status = 'pending'
     and send_after < now() - interval '5 minutes';

  -- 4. Notifications failed in the last 24 hours
  select count(*) into v_failed_24h
    from notifications
   where status = 'failed'
     and coalesce(sent_at, created_at) >= now() - interval '24 hours';

  -- 5. Time of last successful send
  select max(sent_at) into v_last_sent_at
    from notifications
   where status = 'sent';

  return jsonb_build_object(
    'vault', jsonb_build_object(
      'has_cron_secret', v_has_cron_secret,
      'has_project_url', v_has_project_url
    ),
    'jobs', v_jobs,
    'notifications', jsonb_build_object(
      'pending_lagging_over_5m', v_pending_lagging,
      'failed_last_24h', v_failed_24h,
      'last_sent_at', v_last_sent_at
    )
  );
end;
$$;

revoke all on function fn_scheduler_health() from public, anon, authenticated;
grant execute on function fn_scheduler_health() to service_role;

-- ---------------------------------------------------------------------
-- 3. Scheduler URL Dynamic Lookup & Failure Logging (Issue 3)
-- ---------------------------------------------------------------------

-- Function to trigger send-notifications edge function safely from pg_cron
create or replace function fn_trigger_notification_sender()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_cron_secret text;
  v_project_url text;
  v_req_id bigint;
begin
  select decrypted_secret into v_cron_secret
    from vault.decrypted_secrets
   where name = 'cron_secret';

  if v_cron_secret is null or v_cron_secret = '' then
    raise exception 'Missing required Vault secret: cron_secret';
  end if;

  select decrypted_secret into v_project_url
    from vault.decrypted_secrets
   where name = 'project_url';

  if v_project_url is null or v_project_url = '' then
    raise exception 'Missing required Vault secret: project_url';
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_req_id;

  return v_req_id;
end;
$$;

revoke all on function fn_trigger_notification_sender() from public, anon, authenticated;
grant execute on function fn_trigger_notification_sender() to service_role;

-- Unschedule old medbuddy-send and medbuddy-cleanup jobs if present
do $$
begin
  if exists (select 1 from cron.job where jobname = 'medbuddy-send') then
    perform cron.unschedule('medbuddy-send');
  end if;
  if exists (select 1 from cron.job where jobname = 'medbuddy-cleanup') then
    perform cron.unschedule('medbuddy-cleanup');
  end if;
end $$;

-- Schedule medbuddy-send calling fn_trigger_notification_sender()
select cron.schedule(
  'medbuddy-send',
  '* * * * *',
  $$select fn_trigger_notification_sender();$$
);

-- Schedule medbuddy-cleanup calling fn_cleanup_old_notifications()
select cron.schedule(
  'medbuddy-cleanup',
  '0 3 * * *',
  $$select fn_cleanup_old_notifications();$$
);

-- ---------------------------------------------------------------------
-- 4. Search Path Hardening (Issue 4)
-- ---------------------------------------------------------------------

alter function is_valid_tz(text) set search_path = public;
alter function trg_inventory_init() set search_path = public;
