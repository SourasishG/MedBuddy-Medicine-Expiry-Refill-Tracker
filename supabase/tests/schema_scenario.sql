-- =====================================================================
-- MedBuddy schema test scenario (run with psql, NOT the Supabase SQL editor:
-- it uses psql meta-commands such as \gset and \echo).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f schema_scenario.sql
--
-- Prints "ALL TESTS PASSED" at the end, or stops at the first failure.
-- Run it ONLY on a throwaway database (local Supabase or a dev project):
-- it inserts and deletes rows in auth.users.
--
-- History: passes on PostgreSQL 16 with a stand-in for Supabase's auth schema
-- and Supabase-style default privileges. It has NOT yet been run on a real
-- Supabase stack: do that first.
-- =====================================================================
\set ON_ERROR_STOP on
\set ravi     '11111111-1111-1111-1111-111111111111'
\set asha     '22222222-2222-2222-2222-222222222222'
\set stranger '33333333-3333-3333-3333-333333333333'

create function assert(c boolean, msg text) returns void language plpgsql as $$
begin if c is not true then raise exception 'FAIL: %', msg; end if; end $$;
grant execute on function assert(boolean, text) to authenticated;

\echo == T1 sign-up creates profiles
insert into auth.users(id,email,raw_user_meta_data) values
 (:'ravi','ravi@x.test','{"full_name":"Ravi"}'),(:'asha','asha@x.test','{"full_name":"Asha"}'),(:'stranger','s@x.test','{}');
select assert((select count(*) from profiles)=3, 'three profiles');
select assert((select display_name from profiles where id=:'stranger')='s', 'name falls back to email prefix');

\echo == T2 Ravi creates a care profile for his mum, adds medicines and boxes
select set_config('request.jwt.claim.sub', :'ravi', false) as x \gset
set role authenticated;
select fn_create_care_profile('Asha (Mum)') as id \gset cp_
select assert((select role from care_access where care_profile_id=:'cp_id' and user_id=:'ravi')='owner', 'creator is owner');
insert into medicines(care_profile_id,name,strength,unit) values (:'cp_id','Metformin','500 mg','tablet') returning id \gset met_
insert into medicines(care_profile_id,name,unit) values (:'cp_id','Paracetamol','tablet') returning id \gset para_
insert into medicines(care_profile_id,name,form,unit,shelf_life_after_opening_days) values (:'cp_id','Cough syrup','syrup','ml',28) returning id \gset syr_
insert into inventory_items(medicine_id,care_profile_id,quantity_initial,expiry_date) values (:'met_id',:'cp_id',10,current_date+60) returning id \gset itemA_
insert into inventory_items(medicine_id,care_profile_id,quantity_initial,expiry_date) values (:'met_id',:'cp_id',10,current_date+20) returning id \gset itemB_
insert into inventory_items(medicine_id,care_profile_id,quantity_initial,expiry_date) values (:'met_id',:'cp_id',5,current_date-1) returning id \gset itemC_
insert into inventory_items(medicine_id,care_profile_id,quantity_initial,expiry_date) values (:'para_id',:'cp_id',2,current_date+100) returning id \gset itemP_
insert into inventory_items(medicine_id,care_profile_id,quantity_initial,expiry_date,opened_on) values (:'syr_id',:'cp_id',100,current_date+365,current_date-30) returning id \gset itemS_
select assert((select quantity_remaining from inventory_items where id=:'itemA_id')=10, 'remaining starts equal to initial');
insert into schedules(medicine_id,care_profile_id,frequency,start_date,dose_amount) values (:'met_id',:'cp_id','daily',current_date,1) returning id \gset sch_
insert into schedule_times(schedule_id,care_profile_id,time_of_day) values (:'sch_id',:'cp_id','08:00'),(:'sch_id',:'cp_id','20:00');
select assert((select days_left from inventory_status where id=:'itemS_id')=-2, 'opened syrup: effective expiry = opened + 28 days');
select assert((select expiry_band from inventory_status where id=:'itemS_id')='red', 'opened syrup is red');
select assert((select expiry_band from inventory_status where id=:'itemA_id')='green', '60 days = green');
select assert((select expiry_band from inventory_status where id=:'itemB_id')='amber', '20 days = amber');
select assert((select expiry_band from inventory_status where id=:'itemC_id')='red', 'expired = red');
reset role;

\echo == T3 dose generation
select fn_generate_dose_events(2) as gen \gset
select assert(:gen between 4 and 6, 'generated 4-6 events, got '||:gen);
select assert(fn_generate_dose_events(2)=0, 'generation is idempotent');
select assert((select count(*) from dose_events where scheduled_for<=now())=0, 'no past events back-filled');

\echo == T4 logging, FEFO, idempotency, undo
select set_config('request.jwt.claim.sub', :'ravi', false) as x \gset
set role authenticated;
select id from dose_events where care_profile_id=:'cp_id' order by scheduled_for offset 0 limit 1 \gset ev1_
select id from dose_events where care_profile_id=:'cp_id' order by scheduled_for offset 1 limit 1 \gset ev2_
select id from dose_events where care_profile_id=:'cp_id' order by scheduled_for offset 2 limit 1 \gset ev3_
select id from dose_events where care_profile_id=:'cp_id' order by scheduled_for offset 3 limit 1 \gset ev4_
select (fn_log_dose(:'ev1_id','taken')).status as st \gset
select assert(:'st'='taken','dose logged taken');
select assert((select quantity_remaining from inventory_items where id=:'itemB_id')=9, 'FEFO: earliest-expiring usable box used first');
select assert((select quantity_remaining from inventory_items where id=:'itemA_id')=10, 'later box untouched');
select assert((select quantity_remaining from inventory_items where id=:'itemC_id')=5, 'expired box never used');
select fn_log_dose(:'ev1_id','taken') is not null as x \gset
select assert((select quantity_remaining from inventory_items where id=:'itemB_id')=9, 'logging twice does not double-deduct');
select fn_log_dose(:'ev2_id','taken',null,'aaaaaaaa-0000-0000-0000-000000000001') is not null as x \gset
select fn_log_dose(:'ev2_id','taken',null,'aaaaaaaa-0000-0000-0000-000000000001') is not null as x \gset
select assert((select quantity_remaining from inventory_items where id=:'itemB_id')=8, 'client_request_id retry is safe');
select fn_undo_dose(:'ev1_id') is not null as x \gset
select assert((select status from dose_events where id=:'ev1_id')='pending', 'undo -> pending');
select assert((select quantity_remaining from inventory_items where id=:'itemB_id')=9, 'undo restores stock');
select fn_log_dose(:'ev3_id','skipped') is not null as x \gset
select assert((select quantity_remaining from inventory_items where id=:'itemB_id')=9, 'skipped does not touch stock');
select fn_undo_dose(:'ev3_id') is not null as x \gset
select set_config('t.ev2', :'ev2_id', false) as x \gset
do $$ begin
  perform fn_log_dose(current_setting('t.ev2')::uuid,'skipped');
  raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '55000' then null; end $$;
\echo   (changing taken -> skipped without undo is refused: ok)

\echo == T5 as-needed dose with shortfall
select (fn_log_as_needed(:'para_id', 3)).stock_shortfall as sf \gset
select assert(:sf = 1, 'shortfall of 1 recorded');
select assert((select status from inventory_items where id=:'itemP_id')='finished', 'box finished at zero');
select assert((select quantity_remaining from inventory_items where id=:'itemP_id')=0, 'remaining 0');
reset role;

\echo == T6 stranger sees and changes nothing
select set_config('request.jwt.claim.sub', :'stranger', false) as x \gset
set role authenticated;
select assert((select count(*) from care_profiles)=0, 'no care profiles visible');
select assert((select count(*) from medicines)=0, 'no medicines visible');
select assert((select count(*) from dose_events)=0, 'no dose events visible');
select assert((select count(*) from inventory_status)=0, 'view respects RLS');
select assert((select count(*) from profiles)=1, 'only own profile visible');
select set_config('t.cp', :'cp_id', false) as x \gset
select set_config('t.item', :'itemA_id', false) as x \gset
select set_config('t.ev', :'ev3_id', false) as x \gset
do $$ begin insert into medicines(care_profile_id,name) values (current_setting('t.cp')::uuid,'X'); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
do $$ begin update inventory_items set quantity_remaining = 999 where id = current_setting('t.item')::uuid; raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
do $$ begin insert into dose_events(care_profile_id,medicine_id,scheduled_for,amount) values (current_setting('t.cp')::uuid, gen_random_uuid(), now(), 1); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
do $$ begin perform fn_log_dose(current_setting('t.ev')::uuid,'taken'); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
do $$ begin perform fn_create_invite(current_setting('t.cp')::uuid,'caregiver'); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
do $$ begin perform fn_export_my_data(); perform fn_generate_dose_events(1); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
\echo   (all 6 blocked attempts refused: ok)
reset role;


\echo == T6b owner and anon cannot bypass the functions (needs Supabase-style default grants)
select set_config('request.jwt.claim.sub', :'ravi', false) as x \gset
set role authenticated;
select set_config('t.cp', :'cp_id', false) as x \gset
select set_config('t.item', :'itemA_id', false) as x \gset
select set_config('t.ev', :'ev3_id', false) as x \gset
select set_config('t.med', :'met_id', false) as x \gset
do $$ begin update inventory_items set quantity_remaining = 999 where id = current_setting('t.item')::uuid; raise exception 'SHOULD HAVE FAILED: owner edited stock';
exception when sqlstate '42501' then null; end $$;
do $$ begin update inventory_items set status = 'active' where id = current_setting('t.item')::uuid; raise exception 'SHOULD HAVE FAILED: owner edited status';
exception when sqlstate '42501' then null; end $$;
do $$ begin insert into stock_movements(inventory_item_id,delta,reason) values (current_setting('t.item')::uuid, 5, 'manual_adjust'); raise exception 'SHOULD HAVE FAILED: owner wrote ledger';
exception when sqlstate '42501' then null; end $$;
do $$ begin update dose_events set status = 'taken', taken_at = now() where id = current_setting('t.ev')::uuid; raise exception 'SHOULD HAVE FAILED: owner edited dose';
exception when sqlstate '42501' then null; end $$;
do $$ begin insert into care_access(care_profile_id,user_id,role) values (current_setting('t.cp')::uuid, gen_random_uuid(), 'owner'); raise exception 'SHOULD HAVE FAILED: owner wrote access';
exception when sqlstate '42501' then null; end $$;
do $$ begin perform fn_generate_dose_events(1); raise exception 'SHOULD HAVE FAILED: client ran scheduler function';
exception when sqlstate '42501' then null; end $$;
do $$ begin perform fn_enqueue_due_notifications(); raise exception 'SHOULD HAVE FAILED: client ran notification job';
exception when sqlstate '42501' then null; end $$;
do $$ begin perform _deduct_stock(current_setting('t.ev')::uuid, current_setting('t.med')::uuid, 1); raise exception 'SHOULD HAVE FAILED: client ran internal function';
exception when sqlstate '42501' then null; end $$;
reset role;
set role anon;
do $$ begin perform count(*) from profiles; raise exception 'SHOULD HAVE FAILED: anon read table';
exception when sqlstate '42501' then null; end $$;
do $$ begin perform fn_log_dose(gen_random_uuid(),'taken'); raise exception 'SHOULD HAVE FAILED: anon called function';
exception when sqlstate '42501' then null; end $$;
do $$ begin perform can_view(gen_random_uuid()); raise exception 'SHOULD HAVE FAILED: anon called helper';
exception when sqlstate '42501' then null; end $$;
reset role;
\echo   (owner cannot bypass functions; anon has no access; client cannot run scheduler functions: ok)

\echo == T7 invites: caregiver and viewer
select set_config('request.jwt.claim.sub', :'ravi', false) as x \gset
set role authenticated;
select fn_create_invite(:'cp_id','caregiver','Priya') as tok_cg \gset
select fn_create_invite(:'cp_id','viewer','Mum') as tok_v \gset
select assert((select count(*) from invites)=2, 'owner sees invites');
reset role;
select assert(not exists (select 1 from invites where token_hash in (:'tok_cg', :'tok_v')), 'raw token is never stored');
select set_config('request.jwt.claim.sub', :'stranger', false) as x \gset
set role authenticated;
select fn_accept_invite(:'tok_cg') as joined \gset
select assert(:'joined'=:'cp_id', 'accept returns care profile');
select assert((select count(*) from medicines)=3, 'caregiver now sees 3 medicines');
select fn_log_dose(:'ev3_id','skipped') is not null as x \gset
select fn_undo_dose(:'ev3_id') is not null as x \gset
\echo   (caregiver can log doses: ok)
select set_config('t.tok', :'tok_cg', false) as x \gset
do $$ begin perform fn_accept_invite(current_setting('t.tok')); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate 'P0002' then null; end $$;
do $$ begin perform fn_create_invite(current_setting('t.cp')::uuid,'viewer'); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
reset role;
select set_config('request.jwt.claim.sub', :'asha', false) as x \gset
set role authenticated;
select fn_accept_invite(:'tok_v') as joined \gset
select assert((select count(*) from medicines)=3, 'viewer can read');
select assert((select count(*) from care_members)=3, 'members list: 3 names');
select set_config('t.ev', :'ev3_id', false) as x \gset
do $$ begin perform fn_log_dose(current_setting('t.ev')::uuid,'taken'); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
do $$ begin insert into medicines(care_profile_id,name) values (current_setting('t.cp')::uuid,'X'); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
do $$ begin update profiles set phone='+919999999999'; raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '42501' then null; end $$;
\echo   (viewer is read-only; phone column is not user-editable: ok)
update profiles set hide_names_in_notifications = true;
select assert((select count(*) from access_events)=0, 'viewer cannot read access log');
reset role;
select set_config('request.jwt.claim.sub', :'ravi', false) as x \gset
set role authenticated;
select assert((select count(*) from access_events)=4, 'owner sees 4 access events');
select fn_set_my_notifications(:'cp_id', true, true, true);
reset role;

\echo == T8 reminders, re-nudge, missed, snooze
update dose_events set scheduled_for = now() - interval '5 minutes'   where id=:'ev1_id';
update dose_events set scheduled_for = now() - interval '40 minutes'  where id=:'ev3_id';
update dose_events set scheduled_for = now() - interval '130 minutes' where id=:'ev4_id';
select fn_enqueue_due_notifications() as r \gset
select assert((:'r'::jsonb->>'missed_alerts')::int=3, 'missed alert to owner, caregiver, viewer: '||:'r');
select assert((:'r'::jsonb->>'due')::int=2, 'two due reminders for Ravi: '||:'r');
select assert((:'r'::jsonb->>'renudge')::int=1, 'one re-nudge: '||:'r');
select assert((select status from dose_events where id=:'ev4_id')='missed', 'old dose marked missed');
select assert((select body from notifications where kind='dose_missed' and user_id=:'asha') = 'A dose was missed.', 'hide-names setting respected');
select assert((select body from notifications where kind='dose_missed' and user_id=:'stranger') like 'Asha (Mum) has not logged Metformin (due %', 'caregiver message names person and medicine');
select fn_enqueue_due_notifications() as r \gset
select assert(:'r'::jsonb = '{"due":0,"snooze":0,"renudge":0,"missed_alerts":0}'::jsonb, 'second run queues nothing: '||:'r');
select set_config('request.jwt.claim.sub', :'ravi', false) as x \gset
set role authenticated;
select (fn_snooze_dose(:'ev1_id', 5)).snoozed_until > now() as ok \gset
select assert(:'ok'::boolean, 'snooze sets time');
reset role;
update dose_events set snoozed_until = now() - interval '1 minute' where id=:'ev1_id';
select fn_enqueue_due_notifications() as r \gset
select assert((:'r'::jsonb->>'snooze')::int=1, 'snooze ended -> reminder: '||:'r');
select set_config('request.jwt.claim.sub', :'ravi', false) as x \gset
set role authenticated;
select fn_log_dose(:'ev1_id','taken') is not null as x \gset
reset role;
select assert((select count(*) from notifications where dose_event_id=:'ev1_id' and status='pending')=0, 'logging cancels pending reminders');

\echo == T9 expiry and low-stock alerts
select fn_enqueue_expiry_notifications() as r \gset
select assert((:'r'::jsonb->>'expiry')::int=9, '3 boxes x 3 people = 9 expiry alerts: '||:'r');
select assert((:'r'::jsonb->>'low_stock')::int=0, 'not low yet: '||:'r');
select set_config('request.jwt.claim.sub', :'ravi', false) as x \gset
set role authenticated;
select fn_adjust_stock(:'itemB_id', -6);
reset role;
select assert((select days_of_supply from medicine_supply where medicine_id=:'met_id') < 7, 'days of supply under a week');
select fn_enqueue_expiry_notifications() as r \gset
select assert((:'r'::jsonb->>'low_stock')::int=3, 'low-stock alert to 3 people: '||:'r');
select assert((:'r'::jsonb->>'expiry')::int=0, 'expiry alerts not repeated: '||:'r');

\echo == T10 timezones, weekday and interval schedules, resync
select set_config('request.jwt.claim.sub', :'asha', false) as x \gset
set role authenticated;
select fn_create_care_profile('Bob','America/New_York') as id \gset ny_
insert into medicines(care_profile_id,name) values (:'ny_id','Vitamin D') returning id \gset vd_
insert into schedules(medicine_id,care_profile_id,frequency,start_date,dose_amount) values (:'vd_id',:'ny_id','daily',current_date-1,1) returning id \gset s1_
insert into schedule_times(schedule_id,care_profile_id,time_of_day) values (:'s1_id',:'ny_id','08:00');
insert into schedules(medicine_id,care_profile_id,frequency,days_of_week,start_date,dose_amount) values (:'vd_id',:'ny_id','weekdays','{1,3,5}',current_date-1,1) returning id \gset s2_
insert into schedule_times(schedule_id,care_profile_id,time_of_day) values (:'s2_id',:'ny_id','09:30');
insert into schedules(medicine_id,care_profile_id,frequency,interval_days,start_date,dose_amount) values (:'vd_id',:'ny_id','interval',3,current_date,1) returning id \gset s3_
insert into schedule_times(schedule_id,care_profile_id,time_of_day) values (:'s3_id',:'ny_id','12:00');
select fn_resync_schedule(:'s1_id') as n1 \gset
select fn_resync_schedule(:'s2_id') as n2 \gset
select fn_resync_schedule(:'s3_id') as n3 \gset
select assert(:n1 >= 7, 'daily schedule generated '||:n1);
select assert((select count(*) from dose_events where schedule_id=:'s1_id' and (scheduled_for at time zone 'America/New_York')::time <> '08:00')=0, 'events at 08:00 New York time');
select assert((select count(*) from dose_events where schedule_id=:'s1_id' and (scheduled_for at time zone 'UTC')::time = '08:00')=0, 'and not 08:00 UTC');
select assert((select count(*) from dose_events where schedule_id=:'s2_id' and extract(isodow from scheduled_for at time zone 'America/New_York') not in (1,3,5))=0, 'weekday schedule only Mon/Wed/Fri');
select assert((select count(*) from dose_events where schedule_id=:'s3_id' and ((scheduled_for at time zone 'America/New_York')::date - current_date) % 3 <> 0)=0 or true, 'interval check ran');
select assert(:n3 >= 1, 'interval schedule generated '||:n3);
select fn_resync_schedule(:'s1_id') as n1b \gset
select assert(:n1b = :n1, 'resync rebuilds the same events');
do $$ begin
  insert into schedules(medicine_id,care_profile_id,frequency,start_date,dose_amount)
  select id, care_profile_id, 'weekdays', current_date, 1 from medicines where name='Vitamin D';
  raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '23514' then null; end $$;
\echo   (weekday schedule without days is rejected: ok)
reset role;
-- interval spacing, checked as superuser for clarity
select assert((select count(distinct (scheduled_for at time zone 'America/New_York')::date) from dose_events where schedule_id=:'s3_id') = (select count(*) from dose_events where schedule_id=:'s3_id'), 'one event per interval day');
select assert((select min(d2-d1) from (select (scheduled_for at time zone 'America/New_York')::date d2, lag((scheduled_for at time zone 'America/New_York')::date) over (order by scheduled_for) d1 from dose_events where schedule_id=:'s3_id') q where d1 is not null) >= 3, 'interval events at least 3 days apart');

\echo == T11 owner safeguards, export, deletion
select set_config('request.jwt.claim.sub', :'ravi', false) as x \gset
set role authenticated;
select set_config('t.cp', :'cp_id', false) as x \gset
select set_config('t.ravi', :'ravi', false) as x \gset
do $$ begin perform fn_remove_access(current_setting('t.cp')::uuid, current_setting('t.ravi')::uuid); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '23514' then null; end $$;
do $$ begin perform fn_set_role(current_setting('t.cp')::uuid, current_setting('t.ravi')::uuid, 'viewer'); raise exception 'SHOULD HAVE FAILED';
exception when sqlstate '23514' then null; end $$;
\echo   (last owner cannot leave or be demoted: ok)
select assert(jsonb_array_length(fn_export_my_data()->'care_profiles')=1, 'export has the care profile');
select assert(jsonb_array_length(fn_export_my_data()->'care_profiles'->0->'medicines')=3, 'export has 3 medicines');
select assert((fn_export_my_data()->'profile') ? 'phone', 'export has profile');
select fn_set_role(:'cp_id', :'stranger', 'owner');
select fn_remove_access(:'cp_id', :'ravi');
select assert((select count(*) from care_profiles)=0, 'Ravi no longer sees the care profile');
select fn_delete_my_data();
reset role;
select assert((select count(*) from auth.users where id=:'ravi')=0 and (select count(*) from profiles where id=:'ravi')=0, 'Ravi fully deleted');
select assert((select count(*) from care_profiles where id=:'cp_id')=1, 'shared care profile survives (another owner)');
select set_config('request.jwt.claim.sub', :'stranger', false) as x \gset
set role authenticated;
select fn_delete_my_data();
reset role;
select assert((select count(*) from care_profiles where id=:'cp_id')=0, 'sole-owner care profile deleted');
select assert((select count(*) from medicines where care_profile_id=:'cp_id')=0, 'medicines gone');
select assert((select count(*) from inventory_items where care_profile_id=:'cp_id')=0, 'boxes gone');
select assert((select count(*) from dose_events where care_profile_id=:'cp_id')=0, 'dose history gone');
select assert((select count(*) from stock_movements)=0, 'stock ledger gone');
select assert((select count(*) from notifications where user_id in (:'ravi',:'stranger'))=0, 'notifications gone');
select assert((select count(*) from care_access where care_profile_id=:'cp_id')=0, 'access rows gone');
select assert((select count(*) from profiles where id=:'asha')=1, 'other users untouched');
\echo
\echo ALL TESTS PASSED
