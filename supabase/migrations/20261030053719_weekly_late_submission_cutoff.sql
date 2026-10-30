-- Replays received more than five minutes after a week ends cannot change its ranking.
create or replace function game_private.record_weekly_score() returns trigger
language plpgsql security definer set search_path='' as $$
declare week_value date:=date_trunc('week',new.started_at at time zone 'Asia/Ho_Chi_Minh')::date;
  current_week date:=date_trunc('week',clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if new.admin_mode or new.last_tick<=old.last_tick or new.last_score<=0 then return new; end if;
  if week_value<current_week then
    if clock_timestamp()>=((week_value+7)::timestamp at time zone 'Asia/Ho_Chi_Minh')+interval '5 minutes' then return new; end if;
    if not pg_try_advisory_xact_lock(hashtextextended('weekly:'||week_value::text,415399)) then return new; end if;
  end if;
  if exists(select 1 from game_private.weekly_settlements where week_start=week_value) then return new; end if;
  insert into game_private.weekly_scores(week_start,user_id,map_name,difficulty,score,achieved_at)
    values(week_value,new.user_id,new.map_name,new.difficulty,new.last_score,clock_timestamp())
  on conflict(week_start,user_id,map_name,difficulty) do update set score=excluded.score,achieved_at=excluded.achieved_at
    where game_private.weekly_scores.score<excluded.score;
  return new;
end;
$$;
