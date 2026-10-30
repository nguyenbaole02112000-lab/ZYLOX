-- New sessions end at the next Vietnam midnight. Existing sessions are untouched.
alter table game_private.game_sessions add column if not exists quest_cutoff_at timestamptz;

create function game_private.set_game_quest_cutoff() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  new.quest_cutoff_at:=(((new.started_at at time zone 'Asia/Ho_Chi_Minh')::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  return new;
end;
$$;
revoke all on function game_private.set_game_quest_cutoff() from public,anon,authenticated;
create trigger set_game_quest_cutoff before insert on game_private.game_sessions
  for each row execute function game_private.set_game_quest_cutoff();

-- Generate the same deterministic quest set for the period in which a run began.
create function game_private.ensure_quests_for_day(player_id uuid, day_value date) returns void
language plpgsql security definer set search_path='' as $$
declare week_value date:=date_trunc('week',day_value::timestamp)::date;
begin
  if player_id is null or day_value is null or not exists(select 1 from public.profiles where id=player_id)
    then raise exception 'Player or period not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(player_id::text,846133));
  insert into game_private.quest_assignments(user_id,period_start,quest_id)
  select player_id,day_value,id from (
    select id,difficulty,row_number() over (partition by difficulty order by md5(player_id::text||day_value::text||id)) as n
    from game_private.quest_definitions where period='daily' and active and difficulty<>'summary'
  ) choices where (difficulty='easy' and n<=1) or (difficulty='medium' and n<=2) or (difficulty='hard' and n<=1)
  on conflict do nothing;
  insert into game_private.quest_assignments(user_id,period_start,quest_id)
    values(player_id,day_value,'daily_complete_all') on conflict do nothing;
  insert into game_private.quest_assignments(user_id,period_start,quest_id)
  select player_id,week_value,id from (
    select id,difficulty,row_number() over (partition by difficulty order by md5(player_id::text||week_value::text||id)) as n
    from game_private.quest_definitions where period='weekly' and active
  ) choices where n<=2 on conflict do nothing;
end;
$$;
revoke all on function game_private.ensure_quests_for_day(uuid,date) from public,anon,authenticated;

-- Completed rewards in a closed period are settled once if a replay arrives late.
create function game_private.settle_expired_quests(player_id uuid,period_name text,period_value date) returns integer
language plpgsql security definer set search_path='' as $$
declare entry record; completed bigint; total integer:=0;
begin
  if period_name not in ('daily','weekly') then raise exception 'Invalid period'; end if;
  perform 1 from public.player_wallets where user_id=player_id for update;
  if not found then raise exception 'Player wallet not found'; end if;
  for entry in select a.quest_id,a.progress,q.target,q.reward,q.difficulty
    from game_private.quest_assignments a join game_private.quest_definitions q on q.id=a.quest_id
    where a.user_id=player_id and a.period_start=period_value and q.period=period_name and a.claimed_at is null
  loop
    completed:=entry.progress;
    if entry.difficulty='summary' then
      select count(*) into completed from game_private.quest_assignments a2
        join game_private.quest_definitions q2 on q2.id=a2.quest_id
        where a2.user_id=player_id and a2.period_start=period_value
          and q2.period='daily' and q2.difficulty<>'summary' and a2.progress>=q2.target;
    end if;
    if completed>=entry.target then
      insert into game_private.quest_claims(user_id,period_start,quest_id,reward)
        values(player_id,period_value,entry.quest_id,entry.reward) on conflict do nothing;
      if found then
        update game_private.quest_assignments set claimed_at=now()
          where user_id=player_id and period_start=period_value and quest_id=entry.quest_id;
        total:=total+entry.reward;
      end if;
    end if;
  end loop;
  if total>0 then update public.player_wallets set coin=coin+total,updated_at=now() where user_id=player_id; end if;
  return total;
end;
$$;
revoke all on function game_private.settle_expired_quests(uuid,text,date) from public,anon,authenticated;

create or replace function game_private.apply_verified_run_impl(run_id uuid,player_id uuid,tick_count integer,score_value integer,candy_value integer,finished boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare run game_private.game_sessions%rowtype; delta_score integer; delta_candy integer; delta_seconds integer;
  run_day date; run_week date; current_day date:=(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
  current_week date:=date_trunc('week',clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date; settled integer:=0;
begin
  select * into run from game_private.game_sessions where id=run_id and user_id=player_id for update;
  if not found then raise exception 'Game session not found'; end if;
  if tick_count<1 or tick_count>run.physics_fps*3600 or score_value<0 or candy_value<0 then raise exception 'Invalid verified result'; end if;
  if tick_count::numeric/run.physics_fps>extract(epoch from clock_timestamp()-run.started_at)+4 then raise exception 'Game ran faster than real time'; end if;
  if run.quest_cutoff_at is not null and tick_count::numeric/run.physics_fps>extract(epoch from run.quest_cutoff_at-run.started_at)
    then raise exception 'Game session crossed the daily reset'; end if;
  if tick_count<=run.last_tick or run.completed_at is not null then return jsonb_build_object('accepted',false,'completed',run.completed_at is not null); end if;
  if score_value<run.last_score or candy_value<run.last_candy then raise exception 'Game progress cannot move backwards'; end if;
  delta_score:=score_value-run.last_score; delta_candy:=candy_value-run.last_candy;
  delta_seconds:=floor(tick_count::numeric/run.physics_fps)-floor(run.last_tick::numeric/run.physics_fps);
  run_day:=(run.started_at at time zone 'Asia/Ho_Chi_Minh')::date;
  run_week:=date_trunc('week',run_day::timestamp)::date;
  if not run.admin_mode then
    perform game_private.ensure_quests_for_day(player_id,run_day);
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
    from game_private.quest_definitions q where a.quest_id=q.id and a.user_id=player_id
      and ((q.period='daily' and a.period_start=run_day) or (q.period='weekly' and a.period_start=run_week));
    if run_day<current_day then settled:=settled+game_private.settle_expired_quests(player_id,'daily',run_day); end if;
    if run_week<current_week then settled:=settled+game_private.settle_expired_quests(player_id,'weekly',run_week); end if;
  end if;
  update game_private.game_sessions set last_tick=tick_count,last_score=score_value,last_candy=candy_value,
    started_counted=true,completed_at=case when finished then now() else null end where id=run_id;
  return jsonb_build_object('accepted',true,'completed',finished,'score',score_value,
    'candy_earned',case when run.admin_mode then 0 else candy_value end,'expired_quest_coin',settled);
end;
$$;

-- Send the server deadline to the game without trusting the device clock.
create or replace function public.start_game(map_key text,difficulty_key text,entity_key text,fps integer,width_value numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; server_now timestamptz:=clock_timestamp(); cutoff timestamptz;
begin
  cutoff:=(((server_now at time zone 'Asia/Ho_Chi_Minh')::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  if cutoff-server_now<=interval '3 seconds' then raise exception 'Daily quests are resetting. Please try again shortly.'; end if;
  result:=game_private.start_run_impl(map_key,difficulty_key,entity_key,fps,width_value);
  return result||jsonb_build_object('server_time',clock_timestamp(),'quest_cutoff_at',cutoff);
end;
$$;

-- Empty special-quest storage is reserved for future unlock requirements.
create table game_private.special_quest_definitions (
  id text primary key,
  title text not null,
  target_entity_id text references public.entity_definitions(id),
  requirements jsonb not null default '{}'::jsonb,
  active boolean not null default false
);
create table game_private.special_quest_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id text not null references game_private.special_quest_definitions(id),
  progress jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  primary key(user_id,quest_id)
);
alter table game_private.special_quest_definitions enable row level security;
alter table game_private.special_quest_progress enable row level security;
revoke all on game_private.special_quest_definitions,game_private.special_quest_progress from public,anon,authenticated;
