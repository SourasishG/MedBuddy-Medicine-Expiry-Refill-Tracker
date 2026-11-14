-- MedBuddy Migration 2: Notification sender functions and retention
-- Service-role only. Explicitly revoked from public, anon, and authenticated.

-- ---------------------------------------------------------------------
-- 1. Claim notifications for delivery (concurrent-safe worker query)
-- ---------------------------------------------------------------------
create or replace function fn_claim_notifications(p_limit int default 50)
returns setof notifications
language plpgsql
security definer
set search_path = public
as $$
begin
  -- First: mark as failed any pending notification that has exceeded max retry attempts (5)
  update notifications
  set status = 'failed',
      last_error = coalesce(last_error, 'max_attempts_exceeded')
  where status = 'pending'
    and attempts >= 5
    and send_after <= now();

  -- Second: concurrently claim up to p_limit pending rows using FOR UPDATE SKIP LOCKED.
  -- Increment attempts and advance send_after by 2 minutes (visibility timeout for crashed runners).
  return query
  with claimed as (
    select id
    from notifications
    where status = 'pending'
      and send_after <= now()
      and attempts < 5
    order by send_after asc
    limit coalesce(p_limit, 50)
    for update skip locked
  )
  update notifications n
  set attempts = n.attempts + 1,
      send_after = now() + interval '2 minutes'
  from claimed c
  where n.id = c.id
  returning n.*;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Mark notification finished (sent or failed)
-- ---------------------------------------------------------------------
create or replace function fn_finish_notification(
  p_id uuid,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ok then
    update notifications
    set status = 'sent',
        sent_at = now(),
        last_error = null
    where id = p_id;
  else
    update notifications
    set status = 'failed',
        last_error = p_error
    where id = p_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Data minimisation: delete notifications older than 30 days
-- ---------------------------------------------------------------------
create or replace function fn_cleanup_old_notifications()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with deleted as (
    delete from notifications
    where created_at < now() - interval '30 days'
    returning id
  )
  select count(*)::int into v_count from deleted;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Permissions: service-role only, zero client access
-- ---------------------------------------------------------------------
revoke all on function fn_claim_notifications(int) from public, anon, authenticated;
revoke all on function fn_finish_notification(uuid, boolean, text) from public, anon, authenticated;
revoke all on function fn_cleanup_old_notifications() from public, anon, authenticated;

grant execute on function fn_claim_notifications(int) to service_role;
grant execute on function fn_finish_notification(uuid, boolean, text) to service_role;
grant execute on function fn_cleanup_old_notifications() to service_role;
