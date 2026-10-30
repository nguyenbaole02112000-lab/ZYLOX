-- This function is private and can only be reached from checked functions.
create or replace function game_private.ensure_quests(player_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare local_now timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  today date := local_now::date; week_start date := date_trunc('week',local_now)::date;
begin
  if player_id is null or not exists(select 1 from public.profiles where id=player_id) then raise exception 'Player not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(player_id::text,846133));
  insert into game_private.quest_assignments(user_id,period_start,quest_id)
  select player_id,today,id from (
    select id,difficulty,row_number() over (partition by difficulty order by md5(player_id::text||today::text||id)) as n
    from game_private.quest_definitions where period='daily' and active and difficulty<>'summary'
  ) choices where (difficulty='easy' and n<=1) or (difficulty='medium' and n<=2) or (difficulty='hard' and n<=1)
  on conflict do nothing;
  insert into game_private.quest_assignments(user_id,period_start,quest_id) values(player_id,today,'daily_complete_all') on conflict do nothing;
  insert into game_private.quest_assignments(user_id,period_start,quest_id)
  select player_id,week_start,id from (
    select id,difficulty,row_number() over (partition by difficulty order by md5(player_id::text||week_start::text||id)) as n
    from game_private.quest_definitions where period='weekly' and active
  ) choices where n<=2 on conflict do nothing;
end;
$$;
revoke all on function game_private.ensure_quests(uuid) from public,anon,authenticated;

create function game_private.apply_verified_run_impl(run_id uuid, player_id uuid, tick_count integer, score_value integer, candy_value integer, finished boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare run game_private.game_sessions%rowtype; delta_score integer; delta_candy integer; delta_seconds integer;
  local_now timestamp:=now() at time zone 'Asia/Ho_Chi_Minh'; today date:=local_now::date; week_start date:=date_trunc('week',local_now)::date;
begin
  select * into run from game_private.game_sessions where id=run_id and user_id=player_id for update;
  if not found then raise exception 'Game session not found'; end if;
  if tick_count<1 or tick_count>run.physics_fps*3600 or score_value<0 or candy_value<0 then raise exception 'Invalid verified result'; end if;
  if tick_count::numeric/run.physics_fps>extract(epoch from clock_timestamp()-run.started_at)+4 then raise exception 'Game ran faster than real time'; end if;
  if tick_count<=run.last_tick or run.completed_at is not null then return jsonb_build_object('accepted',false,'completed',run.completed_at is not null); end if;
  if score_value<run.last_score or candy_value<run.last_candy then raise exception 'Game progress cannot move backwards'; end if;
  delta_score:=score_value-run.last_score; delta_candy:=candy_value-run.last_candy;
  delta_seconds:=floor(tick_count::numeric/run.physics_fps)-floor(run.last_tick::numeric/run.physics_fps);
  if not run.admin_mode then
    perform game_private.ensure_quests(player_id);
    update public.player_wallets set candy=candy+delta_candy,updated_at=now() where user_id=player_id;
    if score_value>0 then
      insert into game_private.leaderboard_scores(user_id,map_name,difficulty,score) values(player_id,run.map_name,run.difficulty,score_value)
      on conflict(user_id,map_name,difficulty) do update set score=excluded.score,achieved_at=now()
      where game_private.leaderboard_scores.score<excluded.score;
    end if;
    update game_private.quest_assignments a set progress=least(q.target,
      case q.metric
        when 'games_started' then a.progress+case when run.started_counted then 0 else 1 end
        when 'games_completed' then a.progress+case when finished then 1 else 0 end
        when 'night_games' then a.progress+case when run.started_counted then 0 else 1 end
        when 'candy' then a.progress+delta_candy
        when 'score_total' then a.progress+delta_score
        when 'survival_seconds' then a.progress+delta_seconds
        when 'best_score' then greatest(a.progress,score_value)
        when 'survival_run' then greatest(a.progress,floor(tick_count::numeric/run.physics_fps)::bigint)
        else a.progress end)
    from game_private.quest_definitions q
    where a.quest_id=q.id and a.user_id=player_id and
      ((q.period='daily' and a.period_start=today) or (q.period='weekly' and a.period_start=week_start));
  end if;
  update game_private.game_sessions set last_tick=tick_count,last_score=score_value,last_candy=candy_value,
    started_counted=true,completed_at=case when finished then now() else null end where id=run_id;
  return jsonb_build_object('accepted',true,'completed',finished,'score',score_value,'candy_earned',case when run.admin_mode then 0 else candy_value end);
end;
$$;
revoke all on function game_private.apply_verified_run_impl(uuid,uuid,integer,integer,integer,boolean) from public,anon,authenticated;
grant usage on schema game_private to service_role;
grant execute on function game_private.apply_verified_run_impl(uuid,uuid,integer,integer,integer,boolean) to service_role;
create function public.apply_verified_run(run_id uuid,player_id uuid,tick_count integer,score_value integer,candy_value integer,finished boolean) returns jsonb
language sql security invoker set search_path='' as $$select game_private.apply_verified_run_impl(run_id,player_id,tick_count,score_value,candy_value,finished);$$;
revoke all on function public.apply_verified_run(uuid,uuid,integer,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.apply_verified_run(uuid,uuid,integer,integer,integer,boolean) to service_role;

create function game_private.best_scores_impl() returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); result jsonb;
begin
  if player_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select coalesce(jsonb_object_agg('halloween_best_'||lower(regexp_replace(map_name,'[[:space:]]+','_','g'))||'_'||lower(difficulty),score),'{}'::jsonb)
  into result from game_private.leaderboard_scores where user_id=player_id;
  return result;
end;
$$;
revoke all on function game_private.best_scores_impl() from public,anon,authenticated;
grant execute on function game_private.best_scores_impl() to authenticated;
create function public.best_scores() returns jsonb language sql security invoker set search_path='' as $$select game_private.best_scores_impl();$$;
revoke all on function public.best_scores() from public,anon;
grant execute on function public.best_scores() to authenticated;

create or replace function public.claim_quests(period_name text,chosen_id text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if coalesce((game_private.admin_state_impl()->>'enabled')::boolean,false) then raise exception 'Rewards are unavailable in Admin Mode'; end if;
  return game_private.claim_quests_impl(period_name,chosen_id);
end;
$$;
