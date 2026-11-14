-- =====================================================================
-- MedBuddy Phase F1 Review Fixes Scenario Tests
-- Covers:
-- 1. Push subscription cool-down rule (failure_count >= 5 eligible after 1h)
-- 2. Success resetting failure counter and timestamps
-- 3. Deletion of subscription failing for > 7 days
-- 4. Lockdown: new functions refused for anon and authenticated
-- 5. fn_scheduler_health() output verification (with & without secrets)
-- =====================================================================

\set ON_ERROR_STOP on

do $$
begin
  raise notice '== Phase F1 Tests: Starting Verification ==';
end $$;

-- Helper assertion routine
create or replace function test_assert(condition boolean, message text) returns void as $$
begin
  if not condition then
    raise exception 'TEST FAILED: %', message;
  end if;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- T1: Setup Test User & Push Subscriptions
-- ---------------------------------------------------------------------
do $$
declare
  v_uid uuid := '00000000-0000-0000-0000-0000000000f1';
  v_sub_id uuid;
  v_is_eligible boolean;
  v_sub record;
  v_res boolean;
begin
  raise notice '== T1: Push subscription failure tracking, cool-down, and recovery ==';

  -- Create test user in auth.users (trigger creates profile)
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_uid, 'f1@medbuddy.test', '{"full_name": "F1 Test User"}')
  on conflict (id) do nothing;

  -- Create fresh push subscription
  insert into push_subscriptions (user_id, endpoint, p256dh, auth_key)
  values (v_uid, 'https://push.example.com/sub-f1', 'key-p256dh', 'key-auth')
  returning id into v_sub_id;

  -- 1. Record failure: failure_count becomes 1, timestamps initialized
  perform fn_record_push_failure(v_sub_id);
  
  select * into v_sub from push_subscriptions where id = v_sub_id;
  perform test_assert(v_sub.failure_count = 1, 'failure_count must be 1 after single failure');
  perform test_assert(v_sub.first_failure_at is not null, 'first_failure_at must be populated');
  perform test_assert(v_sub.last_failure_at is not null, 'last_failure_at must be populated');

  -- 2. Simulate 5 failures within last 10 minutes
  update push_subscriptions
     set failure_count = 5,
         last_failure_at = now() - interval '10 minutes'
   where id = v_sub_id;

  -- Verify NOT eligible (failure_count >= 5 and cooled down only 10m < 1h)
  select exists(select 1 from eligible_push_subscriptions where id = v_sub_id) into v_is_eligible;
  perform test_assert(not v_is_eligible, 'Subscription with 5 failures within 10m must NOT be eligible');

  -- 3. Cool-down rule: after 65 minutes, must become eligible again!
  update push_subscriptions
     set last_failure_at = now() - interval '65 minutes'
   where id = v_sub_id;

  select exists(select 1 from eligible_push_subscriptions where id = v_sub_id) into v_is_eligible;
  perform test_assert(v_is_eligible, 'Subscription with 5 failures after 65m cool-down MUST be eligible');
  raise notice '  ✓ Cool-down rule verified (eligible after 1 hour)';

  -- 4. Success resets failure counters and timestamps
  perform fn_record_push_success(v_sub_id);
  select * into v_sub from push_subscriptions where id = v_sub_id;
  perform test_assert(v_sub.failure_count = 0, 'failure_count must be reset to 0');
  perform test_assert(v_sub.first_failure_at is null, 'first_failure_at must be cleared to null');
  perform test_assert(v_sub.last_failure_at is null, 'last_failure_at must be cleared to null');
  perform test_assert(v_sub.last_success_at is not null, 'last_success_at must be updated');
  raise notice '  ✓ Success reset verified (counters and failure timestamps cleared)';

  -- 5. Stale subscription failing for > 7 days is deleted on failure
  update push_subscriptions
     set first_failure_at = now() - interval '8 days',
         last_failure_at = now() - interval '8 days',
         failure_count = 10
   where id = v_sub_id;

  v_res := fn_record_push_failure(v_sub_id);
  perform test_assert(not v_res, 'fn_record_push_failure must return false when deleting');
  perform test_assert(not exists(select 1 from push_subscriptions where id = v_sub_id), 'Subscription failing > 7 days must be deleted');
  raise notice '  ✓ 7-day failure cutoff deletion verified';

  -- Clean up test profile and user
  delete from auth.users where id = v_uid;
end $$;

-- ---------------------------------------------------------------------
-- T2: Permission Lockdown on New Functions & View
-- ---------------------------------------------------------------------
do $$
begin
  raise notice '== T2: Permission lockdown for anon and authenticated ==';
end $$;

-- Set role to anon
set role anon;

do $$ begin perform fn_record_push_failure(gen_random_uuid()); raise exception 'SHOULD HAVE FAILED: anon called fn_record_push_failure';
exception when sqlstate '42501' then null; end $$;

do $$ begin perform fn_record_push_success(gen_random_uuid()); raise exception 'SHOULD HAVE FAILED: anon called fn_record_push_success';
exception when sqlstate '42501' then null; end $$;

do $$ begin perform fn_scheduler_health(); raise exception 'SHOULD HAVE FAILED: anon called fn_scheduler_health';
exception when sqlstate '42501' then null; end $$;

do $$ begin perform fn_trigger_notification_sender(); raise exception 'SHOULD HAVE FAILED: anon called fn_trigger_notification_sender';
exception when sqlstate '42501' then null; end $$;

do $$ begin perform count(*) from eligible_push_subscriptions; raise exception 'SHOULD HAVE FAILED: anon read eligible_push_subscriptions';
exception when sqlstate '42501' then null; end $$;

-- Set role to authenticated
reset role;
set role authenticated;

do $$ begin perform fn_record_push_failure(gen_random_uuid()); raise exception 'SHOULD HAVE FAILED: authenticated called fn_record_push_failure';
exception when sqlstate '42501' then null; end $$;

do $$ begin perform fn_record_push_success(gen_random_uuid()); raise exception 'SHOULD HAVE FAILED: authenticated called fn_record_push_success';
exception when sqlstate '42501' then null; end $$;

do $$ begin perform fn_scheduler_health(); raise exception 'SHOULD HAVE FAILED: authenticated called fn_scheduler_health';
exception when sqlstate '42501' then null; end $$;

do $$ begin perform fn_trigger_notification_sender(); raise exception 'SHOULD HAVE FAILED: authenticated called fn_trigger_notification_sender';
exception when sqlstate '42501' then null; end $$;

-- Reset role back to postgres
reset role;

do $$
begin
  raise notice '  ✓ Anon and authenticated role execution strictly refused';
end $$;

-- ---------------------------------------------------------------------
-- T3: fn_scheduler_health() Verification (With & Without Secrets)
-- ---------------------------------------------------------------------
do $$
declare
  v_health jsonb;
  v_sec_id uuid;
begin
  raise notice '== T3: fn_scheduler_health() verification ==';

  -- 1. With both secrets present
  v_health := fn_scheduler_health();
  perform test_assert((v_health->'vault'->>'has_cron_secret')::boolean = true, 'cron_secret must be detected');
  perform test_assert((v_health->'vault'->>'has_project_url')::boolean = true, 'project_url must be detected');
  perform test_assert(jsonb_array_length(v_health->'jobs') >= 5, 'Must report at least 5 cron jobs');
  perform test_assert((v_health->'notifications'->>'pending_lagging_over_5m') is not null, 'Must report pending lag');
  raise notice '  ✓ fn_scheduler_health reports healthy when both secrets present';

  -- 2. With project_url temporarily renamed
  select id into v_sec_id from vault.decrypted_secrets where name = 'project_url';
  perform vault.update_secret(v_sec_id, new_name := 'project_url_temp_test');

  v_health := fn_scheduler_health();
  perform test_assert((v_health->'vault'->>'has_project_url')::boolean = false, 'project_url must report false when missing');

  -- Restore project_url
  perform vault.update_secret(v_sec_id, new_name := 'project_url');

  v_health := fn_scheduler_health();
  perform test_assert((v_health->'vault'->>'has_project_url')::boolean = true, 'project_url must report true after restore');
  raise notice '  ✓ fn_scheduler_health correctly detects missing secret';
end $$;

-- ---------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------
drop function if exists test_assert(boolean, text);

do $$
begin
  raise notice '=======================================================';
  raise notice 'ALL REVIEW FIXES TESTS PASSED';
  raise notice '=======================================================';
end $$;
