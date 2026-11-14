-- =====================================================================
-- MedBuddy database schema v1  (Supabase / PostgreSQL 15+)
-- Run in the Supabase SQL editor, or as the first migration.
-- Design notes are in MEDBUDDY_DB_DESIGN.md.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
create type care_role      as enum ('owner', 'caregiver', 'viewer');
create type medicine_form  as enum ('tablet','capsule','syrup','drops','ointment','injection','inhaler','patch','other');
create type stock_status   as enum ('active', 'finished', 'discarded');
create type frequency_type as enum ('daily', 'weekdays', 'interval', 'as_needed');
create type food_rule      as enum ('any', 'before_food', 'with_food', 'after_food');
create type dose_status    as enum ('pending', 'taken', 'skipped', 'missed');
create type stock_reason   as enum ('dose_taken', 'dose_undone', 'manual_adjust', 'discarded');
create type notif_kind     as enum ('dose_due', 'dose_renudge', 'dose_missed', 'expiry', 'low_stock');
create type notif_status   as enum ('pending', 'sent', 'failed', 'cancelled');
create type invite_status  as enum ('pending', 'accepted', 'revoked', 'expired');
create type consent_doc    as enum ('terms', 'privacy', 'health_data');

create function is_valid_tz(tz text) returns boolean
language sql stable as $$
  select exists (select 1 from pg_timezone_names where name = tz)
$$;

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------

-- App users. id = Supabase auth user id. Holds only what the app needs.
create table profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  display_name                text not null check (length(display_name) between 1 and 80),
  phone                       text unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),  -- set by the backend only, after OTP verification
  timezone                    text not null default 'Asia/Kolkata' check (is_valid_tz(timezone)),
  large_text                  boolean not null default false,
  hide_names_in_notifications boolean not null default false,  -- lock-screen privacy
  created_at                  timestamptz not null default now()
);

-- Optional autocomplete list. Global, read-only for users. Filled later (v1.2).
create table medicine_catalog (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  strength text,
  form     medicine_form,
  source   text not null,   -- where the entry came from (licence check before importing anything)
  unique (name, strength, form)
);

-- A person whose medicines are tracked. May or may not have an account.
-- This lets a caregiver manage a parent who never installs the app.
create table care_profiles (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(name) between 1 and 80),
  linked_user_id        uuid unique references profiles(id) on delete set null,  -- the account that IS this person, if any
  timezone              text not null default 'Asia/Kolkata' check (is_valid_tz(timezone)),
  renudge_after_minutes int  not null default 30  check (renudge_after_minutes between 5 and 240),
  missed_after_minutes  int  not null default 120 check (missed_after_minutes between 30 and 720),
  snooze_minutes        int  not null default 10  check (snooze_minutes between 5 and 120),
  created_by            uuid default auth.uid() references profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  check (missed_after_minutes > renudge_after_minutes)
);

-- Who can see or manage which care profile. This one table drives family sharing.
create table care_access (
  care_profile_id uuid not null references care_profiles(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  role            care_role not null,
  notify_due      boolean not null default false,  -- reminders when a dose is due
  notify_missed   boolean not null default false,  -- alert when a dose is missed
  notify_expiry   boolean not null default true,   -- expiry and low-stock alerts
  created_at      timestamptz not null default now(),
  primary key (care_profile_id, user_id)
);
create index care_access_user_idx on care_access (user_id);

-- Invite links. The token itself is never stored, only its hash.
create table invites (
  id              uuid primary key default gen_random_uuid(),
  care_profile_id uuid not null references care_profiles(id) on delete cascade,
  invited_by      uuid references profiles(id) on delete set null,
  role            care_role not null check (role in ('caregiver', 'viewer')),
  token_hash      text not null unique,
  invitee_hint    text check (length(invitee_hint) <= 60),   -- label for the owner only, e.g. "Priya"
  status          invite_status not null default 'pending',
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- What the medicine IS (name, strength, form).
create table medicines (
  id                            uuid primary key default gen_random_uuid(),
  care_profile_id               uuid not null references care_profiles(id) on delete cascade,
  name                          text not null check (length(name) between 1 and 120),
  strength                      text check (length(strength) <= 40),
  form                          medicine_form not null default 'tablet',
  unit                          text not null default 'tablet' check (length(unit) between 1 and 20),  -- tablet, ml, drop, puff
  shelf_life_after_opening_days int check (shelf_life_after_opening_days > 0),
  purpose                       text check (length(purpose) <= 200),
  notes                         text check (length(notes) <= 500),
  catalog_id                    uuid references medicine_catalog(id) on delete set null,
  archived_at                   timestamptz,
  created_at                    timestamptz not null default now(),
  unique (id, care_profile_id)
);
create index medicines_cp_idx on medicines (care_profile_id) where archived_at is null;

-- A physical box, strip or bottle. One medicine can have several, with different expiry dates.
create table inventory_items (
  id                 uuid primary key default gen_random_uuid(),
  medicine_id        uuid not null,
  care_profile_id    uuid not null,
  quantity_initial   numeric(10,2) not null check (quantity_initial > 0),
  quantity_remaining numeric(10,2) not null default 0 check (quantity_remaining >= 0),  -- kept in sync by stock_movements
  expiry_date        date not null,
  batch_no           text check (length(batch_no) <= 40),
  storage_location   text check (length(storage_location) <= 60),
  purchased_on       date,
  opened_on          date,
  status             stock_status not null default 'active',
  created_at         timestamptz not null default now(),
  foreign key (medicine_id, care_profile_id) references medicines (id, care_profile_id) on delete cascade
);
create index inventory_medicine_idx on inventory_items (medicine_id) where status = 'active';
create index inventory_expiry_idx   on inventory_items (expiry_date) where status = 'active';

-- When a medicine is taken.
create table schedules (
  id              uuid primary key default gen_random_uuid(),
  medicine_id     uuid not null,
  care_profile_id uuid not null,
  frequency       frequency_type not null default 'daily',
  days_of_week    smallint[] check (days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]),  -- ISO: 1 = Monday
  interval_days   int check (interval_days between 2 and 365),
  start_date      date not null,
  end_date        date check (end_date >= start_date),
  dose_amount     numeric(8,2) not null check (dose_amount > 0),
  instructions    text check (length(instructions) <= 200),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (id, care_profile_id),
  foreign key (medicine_id, care_profile_id) references medicines (id, care_profile_id) on delete cascade,
  check ((frequency = 'weekdays') = (days_of_week is not null and cardinality(days_of_week) > 0)),
  check ((frequency = 'interval') = (interval_days is not null))
);
create index schedules_cp_idx on schedules (care_profile_id) where active;

-- The times of day for a schedule (e.g. 08:00 and 20:00).
create table schedule_times (
  id              uuid primary key default gen_random_uuid(),
  schedule_id     uuid not null,
  care_profile_id uuid not null,
  time_of_day     time not null,
  dose_amount     numeric(8,2) check (dose_amount > 0),   -- overrides the schedule's amount for this time
  food            food_rule not null default 'any',
  unique (schedule_id, time_of_day),
  foreign key (schedule_id, care_profile_id) references schedules (id, care_profile_id) on delete cascade
);

-- One row per dose: generated ahead of time (7 days) from schedules, then logged.
-- "As needed" doses are inserted at the moment they are taken.
create table dose_events (
  id                uuid primary key default gen_random_uuid(),
  care_profile_id   uuid not null,
  medicine_id       uuid not null,
  schedule_id       uuid references schedules(id) on delete set null,
  schedule_time_id  uuid references schedule_times(id) on delete set null,
  scheduled_for     timestamptz not null,
  amount            numeric(8,2) not null check (amount > 0),
  status            dose_status not null default 'pending',
  taken_at          timestamptz,
  logged_by         uuid references profiles(id) on delete set null,
  logged_at         timestamptz,
  snoozed_until     timestamptz,
  stock_shortfall   numeric(8,2) not null default 0,   -- amount taken that no box could cover
  as_needed         boolean not null default false,
  client_request_id uuid unique,                        -- makes offline sync retries safe
  note              text check (length(note) <= 200),
  created_at        timestamptz not null default now(),
  foreign key (medicine_id, care_profile_id) references medicines (id, care_profile_id) on delete cascade,
  unique (schedule_time_id, scheduled_for),
  check ((status = 'taken') = (taken_at is not null))
);
create index dose_events_pending_idx on dose_events (scheduled_for) where status = 'pending';
create index dose_events_cp_idx      on dose_events (care_profile_id, scheduled_for desc);

-- Every change to a box's quantity. Gives an audit trail and makes "undo" exact.
create table stock_movements (
  id                uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  dose_event_id     uuid references dose_events(id) on delete set null,
  delta             numeric(10,2) not null check (delta <> 0),
  reason            stock_reason not null,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index stock_movements_item_idx  on stock_movements (inventory_item_id);
create index stock_movements_event_idx on stock_movements (dose_event_id);

-- Web Push endpoints, one per browser or installed app.
create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references profiles(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth_key        text not null,
  platform        text check (platform in ('android', 'ios', 'desktop', 'other')),
  user_agent      text check (length(user_agent) <= 300),
  failure_count   int not null default 0,
  last_success_at timestamptz,
  created_at      timestamptz not null default now()
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);

-- Outbox: the scheduler writes rows here, a sender function delivers them.
-- dedupe_key makes every notification idempotent (safe if a job runs twice).
create table notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  care_profile_id   uuid references care_profiles(id) on delete cascade,
  kind              notif_kind not null,
  dose_event_id     uuid references dose_events(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete cascade,
  dedupe_key        text not null,
  title             text not null,
  body              text not null,
  send_after        timestamptz not null default now(),
  status            notif_status not null default 'pending',
  attempts          int not null default 0,
  last_error        text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_pending_idx on notifications (send_after) where status = 'pending';

-- Proof of consent (needed for health data).
create table consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references profiles(id) on delete cascade,
  document     consent_doc not null,
  version      text not null,
  accepted_at  timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (user_id, document, version)
);

-- Who invited, joined or was removed. Visible to the care profile's owners.
create table access_events (
  id              bigint generated always as identity primary key,
  care_profile_id uuid references care_profiles(id) on delete cascade,
  actor_id        uuid references profiles(id) on delete set null,
  target_user_id  uuid references profiles(id) on delete set null,
  action          text not null check (action in ('invite_created','invite_accepted','invite_revoked','access_removed','role_changed')),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Authorisation helpers (used by row-level security)
-- ---------------------------------------------------------------------
create function can_view(cp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from care_access where care_profile_id = cp and user_id = auth.uid())
$$;

create function can_edit(cp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from care_access
                 where care_profile_id = cp and user_id = auth.uid() and role in ('owner', 'caregiver'))
$$;

create function is_owner(cp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from care_access
                 where care_profile_id = cp and user_id = auth.uid() and role = 'owner')
$$;

-- ---------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------

-- New sign-up (Supabase auth) -> profile row.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id,
          left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
                        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                        'Me'), 80));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Creator of a care profile becomes its owner.
create function trg_care_profile_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    raise exception 'created_by is required' using errcode = '23502';
  end if;
  insert into care_access (care_profile_id, user_id, role, notify_due, notify_missed, notify_expiry)
  values (new.id, new.created_by, 'owner', new.linked_user_id is not distinct from new.created_by, false, true);
  return new;
end $$;
create trigger care_profile_owner after insert on care_profiles
  for each row execute function trg_care_profile_owner();

-- A care profile must always keep at least one owner.
create function trg_keep_one_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if exists (select 1 from care_profiles where id = old.care_profile_id)
       and not exists (select 1 from care_access
                       where care_profile_id = old.care_profile_id and role = 'owner' and user_id <> old.user_id) then
      raise exception 'A care profile needs at least one owner' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger keep_one_owner before update or delete on care_access
  for each row execute function trg_keep_one_owner();

-- New box: remaining starts equal to initial.
create function trg_inventory_init() returns trigger
language plpgsql as $$
begin
  new.quantity_remaining := new.quantity_initial;
  return new;
end $$;
create trigger inventory_init before insert on inventory_items
  for each row execute function trg_inventory_init();

-- Ledger row -> update the box's cached quantity and status.
create function trg_apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update inventory_items
     set quantity_remaining = quantity_remaining + new.delta,
         status = case when quantity_remaining + new.delta = 0 and status = 'active'   then 'finished'::stock_status
                       when quantity_remaining + new.delta > 0 and status = 'finished' then 'active'::stock_status
                       else status end
   where id = new.inventory_item_id;
  return new;
end $$;
create trigger apply_stock_movement after insert on stock_movements
  for each row execute function trg_apply_stock_movement();

-- ---------------------------------------------------------------------
-- 5. Views
-- ---------------------------------------------------------------------

-- Each box with its effective expiry (the earlier of printed expiry and
-- "opened on + shelf life after opening") and a green / amber / red band.
create view inventory_status with (security_invoker = true) as
select i.*,
       m.name  as medicine_name,
       m.unit  as unit,
       least(i.expiry_date, i.opened_on + m.shelf_life_after_opening_days) as effective_expiry,
       least(i.expiry_date, i.opened_on + m.shelf_life_after_opening_days)
         - (now() at time zone cp.timezone)::date as days_left,
       case
         when least(i.expiry_date, i.opened_on + m.shelf_life_after_opening_days)
              - (now() at time zone cp.timezone)::date <= 7  then 'red'
         when least(i.expiry_date, i.opened_on + m.shelf_life_after_opening_days)
              - (now() at time zone cp.timezone)::date <= 30 then 'amber'
         else 'green'
       end as expiry_band
from inventory_items i
join medicines m       on m.id  = i.medicine_id
join care_profiles cp  on cp.id = i.care_profile_id;

-- Per medicine: usable stock, average daily use, days of supply left.
create view medicine_supply with (security_invoker = true) as
with usage as (
  select s.medicine_id,
         sum(coalesce(st.dose_amount, s.dose_amount) *
             case s.frequency
               when 'daily'    then 1.0
               when 'weekdays' then cardinality(s.days_of_week) / 7.0
               when 'interval' then 1.0 / s.interval_days
             end) as daily_usage
  from schedules s
  join schedule_times st on st.schedule_id = s.id
  where s.active and s.frequency <> 'as_needed' and (s.end_date is null or s.end_date >= current_date)
  group by s.medicine_id
), stock as (
  select medicine_id, sum(quantity_remaining) as remaining
  from inventory_status
  where status = 'active' and days_left >= 0
  group by medicine_id
)
select m.id as medicine_id,
       m.care_profile_id,
       coalesce(stock.remaining, 0) as remaining,
       usage.daily_usage,
       case when usage.daily_usage > 0 then round(coalesce(stock.remaining, 0) / usage.daily_usage, 1) end as days_of_supply
from medicines m
left join usage on usage.medicine_id = m.id
left join stock on stock.medicine_id = m.id
where m.archived_at is null;

-- Names of the people who share a care profile with you (no phone numbers).
-- Runs with owner rights on purpose, filtered by can_view().
create view care_members as
select a.care_profile_id, a.user_id, p.display_name, a.role
from care_access a
join profiles p on p.id = a.user_id
where can_view(a.care_profile_id);

-- ---------------------------------------------------------------------
-- 6. Functions the app calls (each checks permissions itself)
-- ---------------------------------------------------------------------

-- Creates a care profile and makes the caller its owner.
-- p_is_me = true links it to the caller's own account (their own medicines).
create function fn_create_care_profile(p_name text, p_timezone text default 'Asia/Kolkata', p_is_me boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  insert into care_profiles (name, timezone, linked_user_id, created_by)
  values (p_name, p_timezone, case when p_is_me then auth.uid() end, auth.uid())
  returning id into new_id;
  return new_id;
end $$;

create function fn_create_invite(p_care_profile uuid, p_role care_role, p_hint text default null)
returns text language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if not is_owner(p_care_profile) then raise exception 'Not allowed' using errcode = '42501'; end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into invites (care_profile_id, invited_by, role, token_hash, invitee_hint)
  values (p_care_profile, auth.uid(), p_role, encode(sha256(convert_to(tok, 'utf8')), 'hex'), p_hint);
  insert into access_events (care_profile_id, actor_id, action) values (p_care_profile, auth.uid(), 'invite_created');
  return tok;   -- shown once; only the hash is stored
end $$;

create function fn_accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv invites;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select * into inv from invites
   where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
     and status = 'pending' and expires_at > now()
   for update;
  if not found then raise exception 'Invite is invalid or expired' using errcode = 'P0002'; end if;
  insert into care_access (care_profile_id, user_id, role, notify_due, notify_missed, notify_expiry)
  values (inv.care_profile_id, auth.uid(), inv.role, false, true, true)
  on conflict (care_profile_id, user_id) do nothing;
  update invites set status = 'accepted', accepted_by = auth.uid() where id = inv.id;
  insert into access_events (care_profile_id, actor_id, target_user_id, action)
  values (inv.care_profile_id, auth.uid(), auth.uid(), 'invite_accepted');
  return inv.care_profile_id;
end $$;

create function fn_revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cp uuid;
begin
  select care_profile_id into cp from invites where id = p_invite and status = 'pending';
  if cp is null or not is_owner(cp) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update invites set status = 'revoked' where id = p_invite;
  insert into access_events (care_profile_id, actor_id, action) values (cp, auth.uid(), 'invite_revoked');
end $$;

create function fn_set_role(p_care_profile uuid, p_user uuid, p_role care_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner(p_care_profile) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update care_access set role = p_role where care_profile_id = p_care_profile and user_id = p_user;
  insert into access_events (care_profile_id, actor_id, target_user_id, action)
  values (p_care_profile, auth.uid(), p_user, 'role_changed');
end $$;

-- Owner removes someone, or anyone removes themselves.
create function fn_remove_access(p_care_profile uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_owner(p_care_profile) or p_user = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from care_access where care_profile_id = p_care_profile and user_id = p_user;
  insert into access_events (care_profile_id, actor_id, target_user_id, action)
  values (p_care_profile, auth.uid(), p_user, 'access_removed');
end $$;

create function fn_set_my_notifications(p_care_profile uuid, p_due boolean, p_missed boolean, p_expiry boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update care_access
     set notify_due = p_due, notify_missed = p_missed, notify_expiry = p_expiry
   where care_profile_id = p_care_profile and user_id = auth.uid();
  if not found then raise exception 'Not allowed' using errcode = '42501'; end if;
end $$;

-- Internal: take stock for a dose, earliest-expiring usable box first.
create function _deduct_stock(p_event uuid, p_medicine uuid, p_amount numeric) returns numeric
language plpgsql security definer set search_path = public as $$
declare need numeric := p_amount; it record; take numeric; tz text;
begin
  select cp.timezone into tz
    from medicines m join care_profiles cp on cp.id = m.care_profile_id where m.id = p_medicine;
  for it in
    select i.id, i.quantity_remaining
      from inventory_items i
      join medicines m on m.id = i.medicine_id
     where i.medicine_id = p_medicine and i.status = 'active' and i.quantity_remaining > 0
       and least(i.expiry_date, i.opened_on + m.shelf_life_after_opening_days) >= (now() at time zone tz)::date
     order by least(i.expiry_date, i.opened_on + m.shelf_life_after_opening_days), i.created_at
       for update of i
  loop
    take := least(it.quantity_remaining, need);
    insert into stock_movements (inventory_item_id, dose_event_id, delta, reason, created_by)
    values (it.id, p_event, -take, 'dose_taken', auth.uid());
    need := need - take;
    exit when need <= 0;
  end loop;
  return greatest(need, 0);   -- what no box could cover
end $$;

create function fn_log_dose(p_event uuid, p_status dose_status, p_taken_at timestamptz default null,
                            p_client_request_id uuid default null)
returns dose_events language plpgsql security definer set search_path = public as $$
declare ev dose_events;
begin
  if p_status not in ('taken', 'skipped') then
    raise exception 'Status must be taken or skipped' using errcode = '22023';
  end if;
  if p_client_request_id is not null then
    select * into ev from dose_events where client_request_id = p_client_request_id;
    if found then
      if can_edit(ev.care_profile_id) then return ev; end if;
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  select * into ev from dose_events where id = p_event for update;
  if not found or not can_edit(ev.care_profile_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if ev.status = p_status then return ev; end if;           -- already logged this way
  if ev.status in ('taken', 'skipped') then
    raise exception 'Undo the earlier entry first' using errcode = '55000';
  end if;
  update dose_events
     set status = p_status,
         taken_at = case when p_status = 'taken' then coalesce(p_taken_at, now()) end,
         logged_by = auth.uid(), logged_at = now(), snoozed_until = null,
         client_request_id = p_client_request_id
   where id = ev.id returning * into ev;
  if p_status = 'taken' then
    update dose_events set stock_shortfall = _deduct_stock(ev.id, ev.medicine_id, ev.amount)
     where id = ev.id returning * into ev;
  end if;
  update notifications set status = 'cancelled' where dose_event_id = ev.id and status = 'pending';
  return ev;
end $$;

create function fn_undo_dose(p_event uuid) returns dose_events
language plpgsql security definer set search_path = public as $$
declare ev dose_events;
begin
  select * into ev from dose_events where id = p_event for update;
  if not found or not can_edit(ev.care_profile_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if ev.status not in ('taken', 'skipped') then return ev; end if;
  if ev.status = 'taken' then
    insert into stock_movements (inventory_item_id, dose_event_id, delta, reason, created_by)
    select inventory_item_id, ev.id, -sum(delta), 'dose_undone', auth.uid()
      from stock_movements where dose_event_id = ev.id
     group by inventory_item_id having sum(delta) < 0;
  end if;
  update dose_events
     set status = 'pending', taken_at = null, logged_by = null, logged_at = null,
         stock_shortfall = 0, client_request_id = null
   where id = ev.id returning * into ev;
  return ev;
end $$;

create function fn_snooze_dose(p_event uuid, p_minutes int default null) returns dose_events
language plpgsql security definer set search_path = public as $$
declare ev dose_events; mins int;
begin
  select * into ev from dose_events where id = p_event for update;
  if not found or not can_edit(ev.care_profile_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if ev.status <> 'pending' then raise exception 'Only a pending dose can be snoozed' using errcode = '55000'; end if;
  select coalesce(p_minutes, snooze_minutes) into mins from care_profiles where id = ev.care_profile_id;
  update dose_events set snoozed_until = now() + make_interval(mins => mins)
   where id = ev.id returning * into ev;
  return ev;
end $$;

-- "As needed" medicine taken right now (or at p_taken_at).
create function fn_log_as_needed(p_medicine uuid, p_amount numeric, p_taken_at timestamptz default null,
                                 p_client_request_id uuid default null)
returns dose_events language plpgsql security definer set search_path = public as $$
declare cp uuid; ev dose_events; t timestamptz := coalesce(p_taken_at, now());
begin
  select care_profile_id into cp from medicines where id = p_medicine;
  if cp is null or not can_edit(cp) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_client_request_id is not null then
    select * into ev from dose_events where client_request_id = p_client_request_id;
    if found then return ev; end if;
  end if;
  insert into dose_events (care_profile_id, medicine_id, scheduled_for, amount, status, taken_at,
                           logged_by, logged_at, as_needed, client_request_id)
  values (cp, p_medicine, t, p_amount, 'taken', t, auth.uid(), now(), true, p_client_request_id)
  returning * into ev;
  update dose_events set stock_shortfall = _deduct_stock(ev.id, ev.medicine_id, ev.amount)
   where id = ev.id returning * into ev;
  return ev;
end $$;

create function fn_adjust_stock(p_item uuid, p_delta numeric) returns void
language plpgsql security definer set search_path = public as $$
declare cp uuid;
begin
  select care_profile_id into cp from inventory_items where id = p_item;
  if cp is null or not can_edit(cp) then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into stock_movements (inventory_item_id, delta, reason, created_by)
  values (p_item, p_delta, 'manual_adjust', auth.uid());
end $$;

create function fn_discard_item(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cp uuid; rem numeric;
begin
  select care_profile_id, quantity_remaining into cp, rem from inventory_items where id = p_item for update;
  if cp is null or not can_edit(cp) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if rem > 0 then
    insert into stock_movements (inventory_item_id, delta, reason, created_by)
    values (p_item, -rem, 'discarded', auth.uid());
  end if;
  update inventory_items set status = 'discarded' where id = p_item;
end $$;

-- Dose events for the next N days. Past times are never back-filled.
-- Called by the scheduler daily (all schedules) and after edits (one schedule).
create function fn_generate_dose_events(p_horizon_days int default 7, p_schedule uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into dose_events (care_profile_id, medicine_id, schedule_id, schedule_time_id, scheduled_for, amount)
  select s.care_profile_id, s.medicine_id, s.id, st.id,
         (dd.d::timestamp + st.time_of_day) at time zone cp.timezone,
         coalesce(st.dose_amount, s.dose_amount)
    from schedules s
    join medicines m       on m.id = s.medicine_id and m.archived_at is null
    join care_profiles cp  on cp.id = s.care_profile_id
    join schedule_times st on st.schedule_id = s.id
    cross join lateral generate_series(0, p_horizon_days) as k
    cross join lateral (select (now() at time zone cp.timezone)::date + k as d) dd
   where s.active and s.frequency <> 'as_needed'
     and (p_schedule is null or s.id = p_schedule)
     and dd.d >= s.start_date and (s.end_date is null or dd.d <= s.end_date)
     and case s.frequency
           when 'daily'    then true
           when 'weekdays' then extract(isodow from dd.d)::int = any (s.days_of_week)
           when 'interval' then (dd.d - s.start_date) % s.interval_days = 0
         end
     and (dd.d::timestamp + st.time_of_day) at time zone cp.timezone > now()
  on conflict (schedule_time_id, scheduled_for) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- After editing, pausing or ending a schedule: rebuild its future doses.
create function fn_resync_schedule(p_schedule uuid) returns int
language plpgsql security definer set search_path = public as $$
declare cp uuid;
begin
  select care_profile_id into cp from schedules where id = p_schedule;
  if cp is null or not can_edit(cp) then raise exception 'Not allowed' using errcode = '42501'; end if;
  delete from dose_events where schedule_id = p_schedule and status = 'pending' and scheduled_for > now();
  return fn_generate_dose_events(7, p_schedule);
end $$;

-- Scheduler job, every minute: marks missed doses and queues due / re-nudge / snooze / missed alerts.
create function fn_enqueue_due_notifications() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c_miss int; c_due int; c_ren int; c_snz int;
begin
  -- 1. missed doses, with an alert for people who opted in
  with missed as (
    update dose_events e set status = 'missed'
      from care_profiles cp
     where cp.id = e.care_profile_id and e.status = 'pending'
       and e.scheduled_for + make_interval(mins => cp.missed_after_minutes) <= now()
    returning e.id, e.care_profile_id, e.medicine_id, e.scheduled_for, cp.name as person, cp.timezone
  ), ins as (
    insert into notifications (user_id, care_profile_id, kind, dose_event_id, dedupe_key, title, body)
    select a.user_id, x.care_profile_id, 'dose_missed', x.id, 'missed:' || x.id || ':' || a.user_id,
           'Missed dose',
           case when p.hide_names_in_notifications then 'A dose was missed.'
                else x.person || ' has not logged ' || m.name || ' (due '
                     || to_char(x.scheduled_for at time zone x.timezone, 'HH12:MI AM') || ')' end
      from missed x
      join medicines m   on m.id = x.medicine_id
      join care_access a on a.care_profile_id = x.care_profile_id and a.notify_missed
      join profiles p    on p.id = a.user_id
    on conflict (user_id, dedupe_key) do nothing
    returning 1
  ) select count(*) into c_miss from ins;   -- number of missed alerts queued

  -- 2. due now
  with ins as (
    insert into notifications (user_id, care_profile_id, kind, dose_event_id, dedupe_key, title, body)
    select a.user_id, e.care_profile_id, 'dose_due', e.id, 'due:' || e.id || ':' || a.user_id,
           case when cp.linked_user_id = a.user_id then 'Time for your medicine' else cp.name || ': dose due' end,
           case when p.hide_names_in_notifications then 'A dose is due.'
                else m.name || coalesce(' ' || m.strength, '') || ' - ' || trim(trailing '.' from trim(trailing '0' from e.amount::text)) || ' ' || m.unit end
      from dose_events e
      join medicines m       on m.id = e.medicine_id
      join care_profiles cp  on cp.id = e.care_profile_id
      join care_access a     on a.care_profile_id = e.care_profile_id and a.notify_due
      join profiles p        on p.id = a.user_id
     where e.status = 'pending' and e.snoozed_until is null
       and e.scheduled_for <= now() and e.scheduled_for > now() - interval '1 day'
    on conflict (user_id, dedupe_key) do nothing
    returning 1
  ) select count(*) into c_due from ins;

  -- 3. gentle second reminder
  with ins as (
    insert into notifications (user_id, care_profile_id, kind, dose_event_id, dedupe_key, title, body)
    select a.user_id, e.care_profile_id, 'dose_renudge', e.id, 'renudge:' || e.id || ':' || a.user_id,
           'Dose still pending',
           case when p.hide_names_in_notifications then 'A dose is still waiting.'
                else m.name || ' has not been logged yet.' end
      from dose_events e
      join medicines m       on m.id = e.medicine_id
      join care_profiles cp  on cp.id = e.care_profile_id
      join care_access a     on a.care_profile_id = e.care_profile_id and a.notify_due
      join profiles p        on p.id = a.user_id
     where e.status = 'pending' and e.snoozed_until is null
       and e.scheduled_for + make_interval(mins => cp.renudge_after_minutes) <= now()
       and e.scheduled_for > now() - interval '1 day'
    on conflict (user_id, dedupe_key) do nothing
    returning 1
  ) select count(*) into c_ren from ins;

  -- 4. snooze finished
  with ins as (
    insert into notifications (user_id, care_profile_id, kind, dose_event_id, dedupe_key, title, body)
    select a.user_id, e.care_profile_id, 'dose_due', e.id,
           'snooze:' || e.id || ':' || a.user_id || ':' || floor(extract(epoch from e.snoozed_until))::bigint,
           'Reminder',
           case when p.hide_names_in_notifications then 'A dose is due.' else m.name || ' is due now.' end
      from dose_events e
      join medicines m   on m.id = e.medicine_id
      join care_access a on a.care_profile_id = e.care_profile_id and a.notify_due
      join profiles p    on p.id = a.user_id
     where e.status = 'pending' and e.snoozed_until is not null and e.snoozed_until <= now()
    on conflict (user_id, dedupe_key) do nothing
    returning 1
  ) select count(*) into c_snz from ins;

  return jsonb_build_object('missed_alerts', c_miss, 'due', c_due, 'renudge', c_ren, 'snooze', c_snz);
end $$;

-- Scheduler job, once a day: expiry alerts (30 / 15 / 7 days / expired) and low-stock alerts.
create function fn_enqueue_expiry_notifications() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c_exp int; c_low int;
begin
  with ins as (
    insert into notifications (user_id, care_profile_id, kind, inventory_item_id, dedupe_key, title, body)
    select a.user_id, s.care_profile_id, 'expiry', s.id, 'expiry:' || s.id || ':' || s.threshold,
           case when s.days_left <= 0 then 'Medicine expired' else 'Medicine expiring soon' end,
           case when p.hide_names_in_notifications then 'A medicine needs attention.'
                when s.days_left <= 0 then s.medicine_name || ' has expired.'
                else s.medicine_name || ' expires in ' || s.days_left || ' days.' end
      from (select v.*, case when v.days_left <= 0 then 0 when v.days_left <= 7 then 7
                             when v.days_left <= 15 then 15 when v.days_left <= 30 then 30 end as threshold
              from inventory_status v where v.status = 'active' and v.quantity_remaining > 0) s
      join care_access a on a.care_profile_id = s.care_profile_id and a.notify_expiry
      join profiles p    on p.id = a.user_id
     where s.threshold is not null
    on conflict (user_id, dedupe_key) do nothing
    returning 1
  ) select count(*) into c_exp from ins;

  with ins as (
    insert into notifications (user_id, care_profile_id, kind, dedupe_key, title, body)
    select a.user_id, ms.care_profile_id, 'low_stock',
           'low:' || ms.medicine_id || ':' || to_char(current_date, 'IYYY-IW') || ':' || a.user_id,
           'Time to refill',
           case when p.hide_names_in_notifications then 'A medicine may run out soon.'
                else m.name || ' may run out in about ' || ceil(ms.days_of_supply)::int || ' days.' end
      from medicine_supply ms
      join medicines m   on m.id = ms.medicine_id
      join care_access a on a.care_profile_id = ms.care_profile_id and a.notify_expiry
      join profiles p    on p.id = a.user_id
     where ms.days_of_supply is not null and ms.days_of_supply <= 7
    on conflict (user_id, dedupe_key) do nothing
    returning 1
  ) select count(*) into c_low from ins;

  return jsonb_build_object('expiry', c_exp, 'low_stock', c_low);
end $$;

-- "Download my data".
create function fn_export_my_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile',  (select to_jsonb(p) - 'id' from profiles p where p.id = auth.uid()),
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'id' - 'user_id') from consents c where c.user_id = auth.uid()), '[]'::jsonb),
    'care_profiles', coalesce((
      select jsonb_agg(to_jsonb(cp) - 'created_by' || jsonb_build_object(
        'medicines',   coalesce((select jsonb_agg(to_jsonb(m))  from medicines m         where m.care_profile_id = cp.id), '[]'::jsonb),
        'inventory',   coalesce((select jsonb_agg(to_jsonb(i))  from inventory_items i   where i.care_profile_id = cp.id), '[]'::jsonb),
        'schedules',   coalesce((select jsonb_agg(to_jsonb(s))  from schedules s         where s.care_profile_id = cp.id), '[]'::jsonb),
        'dose_events', coalesce((select jsonb_agg(to_jsonb(e))  from dose_events e       where e.care_profile_id = cp.id), '[]'::jsonb)))
      from care_profiles cp
      join care_access a on a.care_profile_id = cp.id and a.user_id = auth.uid() and a.role = 'owner'), '[]'::jsonb)
  )
$$;

-- "Delete everything about me". Care profiles with no other owner are deleted with all their data.
create function fn_delete_my_data() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r record;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  for r in select care_profile_id from care_access where user_id = uid and role = 'owner' loop
    if exists (select 1 from care_access
               where care_profile_id = r.care_profile_id and role = 'owner' and user_id <> uid) then
      delete from care_access where care_profile_id = r.care_profile_id and user_id = uid;
    else
      delete from care_profiles where id = r.care_profile_id;
    end if;
  end loop;
  delete from care_access where user_id = uid;
  delete from auth.users where id = uid;   -- cascades to profile, subscriptions, notifications, consents
end $$;

-- ---------------------------------------------------------------------
-- 7. Row-level security
-- ---------------------------------------------------------------------
alter table profiles           enable row level security;
alter table medicine_catalog   enable row level security;
alter table care_profiles      enable row level security;
alter table care_access        enable row level security;
alter table invites            enable row level security;
alter table medicines          enable row level security;
alter table inventory_items    enable row level security;
alter table schedules          enable row level security;
alter table schedule_times     enable row level security;
alter table dose_events        enable row level security;
alter table stock_movements    enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications      enable row level security;
alter table consents           enable row level security;
alter table access_events      enable row level security;

create policy profiles_select on profiles for select using (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy catalog_select on medicine_catalog for select to authenticated using (true);

create policy cp_select on care_profiles for select using (can_view(id));   -- inserts go through fn_create_care_profile
create policy cp_update on care_profiles for update using (is_owner(id)) with check (is_owner(id));
create policy cp_delete on care_profiles for delete using (is_owner(id));

create policy access_select on care_access for select using (user_id = auth.uid() or is_owner(care_profile_id));

create policy invites_select on invites for select using (is_owner(care_profile_id));

create policy med_select on medicines for select using (can_view(care_profile_id));
create policy med_insert on medicines for insert with check (can_edit(care_profile_id));
create policy med_update on medicines for update using (can_edit(care_profile_id)) with check (can_edit(care_profile_id));
create policy med_delete on medicines for delete using (can_edit(care_profile_id));

create policy inv_select on inventory_items for select using (can_view(care_profile_id));
create policy inv_insert on inventory_items for insert with check (can_edit(care_profile_id));
create policy inv_update on inventory_items for update using (can_edit(care_profile_id)) with check (can_edit(care_profile_id));
create policy inv_delete on inventory_items for delete using (can_edit(care_profile_id));

create policy sch_select on schedules for select using (can_view(care_profile_id));
create policy sch_insert on schedules for insert with check (can_edit(care_profile_id));
create policy sch_update on schedules for update using (can_edit(care_profile_id)) with check (can_edit(care_profile_id));
create policy sch_delete on schedules for delete using (can_edit(care_profile_id));

create policy st_select on schedule_times for select using (can_view(care_profile_id));
create policy st_insert on schedule_times for insert with check (can_edit(care_profile_id));
create policy st_update on schedule_times for update using (can_edit(care_profile_id)) with check (can_edit(care_profile_id));
create policy st_delete on schedule_times for delete using (can_edit(care_profile_id));

create policy dose_select on dose_events for select using (can_view(care_profile_id));   -- writes go through fn_log_dose etc.

create policy stock_select on stock_movements for select
  using (exists (select 1 from inventory_items i where i.id = inventory_item_id and can_view(i.care_profile_id)));

create policy push_all on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_select on notifications for select using (user_id = auth.uid());
create policy consent_select on consents for select using (user_id = auth.uid());
create policy consent_insert on consents for insert with check (user_id = auth.uid());
create policy events_select on access_events for select using (is_owner(care_profile_id));

-- ---------------------------------------------------------------------
-- 8. Privileges (anon gets nothing; signed-in users get only what they need)
-- ---------------------------------------------------------------------
-- Supabase grants broad default privileges to anon, authenticated and service_role on
-- everything created in "public". Take them all back from anon and authenticated first,
-- then grant only what is listed below. service_role (the backend) keeps its defaults.
revoke all on all tables    in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
-- Same for anything created later, so a future migration can't expose something by accident.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

grant select on all tables in schema public to authenticated;

grant update (display_name, timezone, large_text, hide_names_in_notifications) on profiles to authenticated;
grant update (name, timezone, renudge_after_minutes, missed_after_minutes, snooze_minutes) on care_profiles to authenticated;
grant delete on care_profiles to authenticated;
grant insert, update, delete on medicines, schedules, schedule_times to authenticated;
grant insert (medicine_id, care_profile_id, quantity_initial, expiry_date, batch_no, storage_location, purchased_on, opened_on)
  on inventory_items to authenticated;
grant update (expiry_date, batch_no, storage_location, purchased_on, opened_on) on inventory_items to authenticated;
grant delete on inventory_items to authenticated;
grant insert, update, delete on push_subscriptions to authenticated;
grant insert (document, version) on consents to authenticated;

-- Functions the signed-in app may call
grant execute on function
  is_valid_tz(text), can_view(uuid), can_edit(uuid), is_owner(uuid),
  fn_create_care_profile(text, text, boolean), fn_create_invite(uuid, care_role, text), fn_accept_invite(text), fn_revoke_invite(uuid),
  fn_set_role(uuid, uuid, care_role), fn_remove_access(uuid, uuid), fn_set_my_notifications(uuid, boolean, boolean, boolean),
  fn_log_dose(uuid, dose_status, timestamptz, uuid), fn_undo_dose(uuid), fn_snooze_dose(uuid, int),
  fn_log_as_needed(uuid, numeric, timestamptz, uuid), fn_adjust_stock(uuid, numeric), fn_discard_item(uuid),
  fn_resync_schedule(uuid), fn_export_my_data(), fn_delete_my_data()
  to authenticated;
-- fn_generate_dose_events, fn_enqueue_*, _deduct_stock and the triggers stay private:
-- only the database owner (scheduler / service role) can run them.

-- ---------------------------------------------------------------------
-- 9. Scheduler (enable pg_cron in Supabase, then run once)
-- ---------------------------------------------------------------------
-- select cron.schedule('medbuddy-enqueue-due',    '* * * * *', $$select fn_enqueue_due_notifications()$$);
-- select cron.schedule('medbuddy-generate-doses', '5 0 * * *', $$select fn_generate_dose_events(7)$$);
-- select cron.schedule('medbuddy-expiry',         '0 4 * * *', $$select fn_enqueue_expiry_notifications()$$);
-- A sender (Supabase Edge Function, called every minute) reads notifications where status = 'pending'
-- and send_after <= now(), delivers them with Web Push, and marks them sent / failed.
