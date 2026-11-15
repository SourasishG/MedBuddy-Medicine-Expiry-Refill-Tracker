-- =====================================================================
-- MedBuddy Migration 5: Atomic Schedule Times Replacement
-- Provides a transactional database function fn_replace_schedule_times
-- that atomically replaces schedule_times and calls fn_resync_schedule.
-- =====================================================================

create or replace function fn_replace_schedule_times(
  p_schedule uuid,
  p_times jsonb,
  p_default_dose numeric default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cp uuid;
  v_time jsonb;
  v_time_str text;
  v_dose numeric;
  v_food food_rule;
  v_inserted int := 0;
begin
  -- Validate schedule and permissions
  select care_profile_id into v_cp from schedules where id = p_schedule;
  if v_cp is null or not can_edit(v_cp) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- Delete existing schedule_times
  delete from schedule_times where schedule_id = p_schedule;

  -- Insert new schedule_times from JSON array
  if p_times is not null and jsonb_typeof(p_times) = 'array' then
    for v_time in select * from jsonb_array_elements(p_times)
    loop
      v_time_str := v_time->>'time';
      if v_time_str is not null and length(trim(v_time_str)) > 0 then
        if length(trim(v_time_str)) = 5 then
          v_time_str := trim(v_time_str) || ':00';
        end if;

        v_dose := coalesce((v_time->>'dose_amount')::numeric, p_default_dose, 1);
        if v_dose <= 0 then v_dose := 1; end if;

        v_food := coalesce((v_time->>'food')::food_rule, 'any'::food_rule);

        insert into schedule_times (
          schedule_id,
          care_profile_id,
          time_of_day,
          dose_amount,
          food
        ) values (
          p_schedule,
          v_cp,
          v_time_str::time,
          v_dose,
          v_food
        ) on conflict (schedule_id, time_of_day) do update
          set dose_amount = excluded.dose_amount,
              food = excluded.food;

        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  -- Trigger resync of future doses
  perform fn_resync_schedule(p_schedule);

  return jsonb_build_object('success', true, 'count', v_inserted);
end;
$$;

revoke all on function fn_replace_schedule_times(uuid, jsonb, numeric) from public;
grant execute on function fn_replace_schedule_times(uuid, jsonb, numeric) to authenticated, service_role;
