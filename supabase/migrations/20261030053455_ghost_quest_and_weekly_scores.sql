-- All existing accounts, wallets, quests, scores, and history remain intact.
create table game_private.ghost_quests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  found_at timestamptz,
  claimed_at timestamptz
);
alter table game_private.ghost_quests enable row level security;
revoke all on game_private.ghost_quests from public,anon,authenticated;

create function game_private.ghost_state_impl() returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); q game_private.ghost_quests%rowtype; owned boolean;
begin
  if player_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'A registered account is required' using errcode='42501'; end if;
  select * into q from game_private.ghost_quests where user_id=player_id;
  select exists(select 1 from public.player_entities where user_id=player_id and entity_id='Ghost') into owned;
  return jsonb_build_object('purchased',q.user_id is not null,'found',q.found_at is not null,'claimed',q.claimed_at is not null,'owned',owned,'price',500);
end;
$$;
create function game_private.purchase_ghost_token_impl() returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); candy_balance bigint;
begin
  if player_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'A registered account is required' using errcode='42501'; end if;
  select candy into candy_balance from public.player_wallets where user_id=player_id for update;
  if not found then raise exception 'Player wallet not found'; end if;
  if exists(select 1 from game_private.ghost_quests where user_id=player_id) then return game_private.ghost_state_impl(); end if;
  if exists(select 1 from public.player_entities where user_id=player_id and entity_id='Ghost') then raise exception 'Ghost is already unlocked'; end if;
  if candy_balance<500 then raise exception 'Not enough Candy'; end if;
  update public.player_wallets set candy=candy-500,updated_at=now() where user_id=player_id;
  insert into game_private.ghost_quests(user_id) values(player_id);
  return game_private.ghost_state_impl();
end;
$$;
create function game_private.claim_ghost_quest_impl() returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); q game_private.ghost_quests%rowtype;
begin
  if player_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'A registered account is required' using errcode='42501'; end if;
  if coalesce((game_private.admin_state_impl()->>'enabled')::boolean,false) then raise exception 'Rewards are unavailable in Admin Mode'; end if;
  select * into q from game_private.ghost_quests where user_id=player_id for update;
  if not found or q.found_at is null then raise exception 'Quest is not complete'; end if;
  if q.claimed_at is null then
    insert into public.player_entities(user_id,entity_id) values(player_id,'Ghost') on conflict do nothing;
    update game_private.ghost_quests set claimed_at=now() where user_id=player_id;
  end if;
  return game_private.ghost_state_impl();
end;
$$;
revoke all on function game_private.ghost_state_impl(),game_private.purchase_ghost_token_impl(),game_private.claim_ghost_quest_impl() from public,anon,authenticated;
grant execute on function game_private.ghost_state_impl(),game_private.purchase_ghost_token_impl(),game_private.claim_ghost_quest_impl() to authenticated;
create function public.ghost_state() returns jsonb language sql security invoker set search_path='' as $$ select game_private.ghost_state_impl(); $$;
create function public.purchase_ghost_token() returns jsonb language sql security invoker set search_path='' as $$ select game_private.purchase_ghost_token_impl(); $$;
create function public.claim_ghost_quest() returns jsonb language sql security invoker set search_path='' as $$ select game_private.claim_ghost_quest_impl(); $$;
revoke all on function public.ghost_state(),public.purchase_ghost_token(),public.claim_ghost_quest() from public,anon,authenticated;
grant execute on function public.ghost_state(),public.purchase_ghost_token(),public.claim_ghost_quest() to authenticated;

-- Lock eligibility to the start of the run, and expose it only for its owner.
alter table game_private.game_sessions add column ghost_eligible boolean not null default false;
create or replace function game_private.set_game_quest_cutoff() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  new.quest_cutoff_at:=(((new.started_at at time zone 'Asia/Ho_Chi_Minh')::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  new.ghost_eligible:=not new.admin_mode and new.entity_id='Witch' and new.map_name='Halloween' and new.difficulty='Nightmare'
    and exists(select 1 from game_private.ghost_quests where user_id=new.user_id and found_at is null and claimed_at is null);
  return new;
end;
$$;
create function game_private.run_ghost_eligible_impl(run_id uuid) returns boolean
language sql security definer set search_path='' as $$
  select coalesce((select ghost_eligible from game_private.game_sessions where id=run_id and user_id=auth.uid()),false);
$$;
revoke all on function game_private.run_ghost_eligible_impl(uuid) from public,anon,authenticated;
grant execute on function game_private.run_ghost_eligible_impl(uuid) to authenticated;
create or replace function public.start_game(map_key text,difficulty_key text,entity_key text,fps integer,width_value numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; server_now timestamptz:=clock_timestamp(); cutoff timestamptz;
begin
  cutoff:=(((server_now at time zone 'Asia/Ho_Chi_Minh')::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  if cutoff-server_now<=interval '3 seconds' then raise exception 'Daily quests are resetting. Please try again shortly.'; end if;
  result:=game_private.start_run_impl(map_key,difficulty_key,entity_key,fps,width_value);
  return result||jsonb_build_object('server_time',clock_timestamp(),'quest_cutoff_at',cutoff,'ghost_eligible',game_private.run_ghost_eligible_impl((result->>'id')::uuid));
end;
$$;
create or replace function game_private.run_challenge_impl(run_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); run game_private.game_sessions%rowtype;
begin
  if player_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select * into run from game_private.game_sessions where id=run_id and user_id=player_id;
  if not found then raise exception 'Game session not found'; end if;
  return jsonb_build_object('id',run.id,'seed',run.seed,'started_at',run.started_at,'completed_at',run.completed_at,
    'map',run.map_name,'difficulty',run.difficulty,'entity',run.entity_id,'fps',run.physics_fps,'width',run.viewport_width,'admin_mode',run.admin_mode,'ghost_eligible',run.ghost_eligible);
end;
$$;
create function game_private.apply_verified_run_v2_impl(run_id uuid,player_id uuid,tick_count integer,score_value integer,candy_value integer,finished boolean,ghost_found boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare outcome jsonb; run game_private.game_sessions%rowtype;
begin
  outcome:=game_private.apply_verified_run_impl(run_id,player_id,tick_count,score_value,candy_value,finished);
  select * into run from game_private.game_sessions where id=run_id and user_id=player_id;
  if coalesce(ghost_found,false) and run.ghost_eligible and not run.admin_mode and run.entity_id='Witch' and run.difficulty='Nightmare' and run.map_name='Halloween' then
    update game_private.ghost_quests set found_at=coalesce(found_at,now()) where user_id=player_id and claimed_at is null;
  end if;
  return outcome;
end;
$$;
revoke all on function game_private.apply_verified_run_v2_impl(uuid,uuid,integer,integer,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function game_private.apply_verified_run_v2_impl(uuid,uuid,integer,integer,integer,boolean,boolean) to service_role;
create function public.apply_verified_run_v2(run_id uuid,player_id uuid,tick_count integer,score_value integer,candy_value integer,finished boolean,ghost_found boolean) returns jsonb
language sql security invoker set search_path='' as $$select game_private.apply_verified_run_v2_impl(run_id,player_id,tick_count,score_value,candy_value,finished,ghost_found);$$;
revoke all on function public.apply_verified_run_v2(uuid,uuid,integer,integer,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.apply_verified_run_v2(uuid,uuid,integer,integer,integer,boolean,boolean) to service_role;

-- Weekly scores and awards are separate from the existing all-time best scores.
-- Briefly serialize existing run updates while seeding and installing the trigger.
lock table game_private.game_sessions in share row exclusive mode;
create table game_private.weekly_scores (
  week_start date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  map_name text not null,
  difficulty text not null,
  score integer not null check(score>0),
  achieved_at timestamptz not null,
  primary key(week_start,user_id,map_name,difficulty)
);
create index weekly_scores_rank on game_private.weekly_scores(week_start,map_name,difficulty,score desc,achieved_at,user_id);
create table game_private.weekly_settlements (week_start date primary key,settled_at timestamptz not null default now());
create table game_private.weekly_awards (
  week_start date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  map_name text not null,
  difficulty text not null,
  rank integer not null check(rank between 1 and 3),
  coin integer not null check(coin>0),
  awarded_at timestamptz not null default now(),
  primary key(week_start,user_id,map_name,difficulty)
);
alter table game_private.weekly_scores enable row level security;
alter table game_private.weekly_settlements enable row level security;
alter table game_private.weekly_awards enable row level security;
revoke all on game_private.weekly_scores,game_private.weekly_settlements,game_private.weekly_awards from public,anon,authenticated;

-- Seed only current-week verified scores; keep all-time tables unchanged.
insert into game_private.weekly_scores(week_start,user_id,map_name,difficulty,score,achieved_at)
select date_trunc('week',s.started_at at time zone 'Asia/Ho_Chi_Minh')::date,s.user_id,s.map_name,s.difficulty,s.last_score,s.started_at
from (select distinct on (user_id,map_name,difficulty) * from game_private.game_sessions
      where not admin_mode and last_score>0 and started_at>=date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'
      order by user_id,map_name,difficulty,last_score desc,started_at,id) s
on conflict do nothing;

create function game_private.record_weekly_score() returns trigger
language plpgsql security definer set search_path='' as $$
declare week_value date:=date_trunc('week',new.started_at at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if new.admin_mode or new.last_tick<=old.last_tick or new.last_score<=0 then return new; end if;
  if week_value<date_trunc('week',clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date then
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
revoke all on function game_private.record_weekly_score() from public,anon,authenticated;
create trigger record_weekly_score after update of last_tick on game_private.game_sessions
  for each row execute function game_private.record_weekly_score();

create function game_private.weekly_reward(difficulty_key text,place integer) returns integer
language sql immutable security invoker set search_path='' as $$
  select case difficulty_key
    when 'Easy' then (array[25,20,15])[place]
    when 'Medium' then (array[50,35,20])[place]
    when 'Hard' then (array[65,50,35])[place]
    when 'Extreme' then (array[80,65,50])[place]
    when 'Nightmare' then (array[100,75,50])[place]
    else null end;
$$;
revoke all on function game_private.weekly_reward(text,integer) from public,anon,authenticated;

create or replace function game_private.leaderboard_impl(map_key text,difficulty_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); answer jsonb; current_week date:=date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if map_key is null or length(map_key)>32 or difficulty_key is null or length(difficulty_key)>32 then raise exception 'Invalid leaderboard'; end if;
  with ranked as (
    select s.user_id,p.username,s.score,row_number() over(order by s.score desc,s.achieved_at,s.user_id) as rank
    from game_private.weekly_scores s join public.profiles p on p.id=s.user_id
    where s.week_start=current_week and s.map_name=map_key and s.difficulty=difficulty_key
  ) select jsonb_build_object('top',coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'username',username,'score',score) order by rank) from ranked where rank<=50),'[]'::jsonb),
    'me',(select jsonb_build_object('rank',rank,'username',username,'score',score) from ranked where user_id=player_id),
    'server_time',now(),'reset_at',((current_week+7)::timestamp at time zone 'Asia/Ho_Chi_Minh'),
    'rewards',jsonb_build_array(game_private.weekly_reward(difficulty_key,1),game_private.weekly_reward(difficulty_key,2),game_private.weekly_reward(difficulty_key,3))) into answer;
  return answer;
end;
$$;

create function game_private.settle_weekly_awards(week_value date) returns integer
language plpgsql security definer set search_path='' as $$
declare paid integer;
begin
  if week_value is null or week_value<>date_trunc('week',week_value::timestamp)::date or
     week_value>=date_trunc('week',(clock_timestamp()-interval '5 minutes') at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Week is not ready to settle'; end if;
  perform pg_advisory_xact_lock(hashtextextended('weekly:'||week_value::text,415399));
  insert into game_private.weekly_settlements(week_start) values(week_value) on conflict do nothing;
  if not found then return 0; end if;
  with ranked as (
    select user_id,map_name,difficulty,row_number() over(partition by map_name,difficulty order by score desc,achieved_at,user_id) as rank
    from game_private.weekly_scores where week_start=week_value
  ), inserted as (
    insert into game_private.weekly_awards(week_start,user_id,map_name,difficulty,rank,coin)
    select week_value,user_id,map_name,difficulty,rank::integer,game_private.weekly_reward(difficulty,rank::integer)
    from ranked where rank<=3 and game_private.weekly_reward(difficulty,rank::integer) is not null on conflict do nothing returning user_id,coin
  ), sums as (select user_id,sum(coin)::integer as coin from inserted group by user_id), updated as (
    update public.player_wallets w set coin=w.coin+s.coin,updated_at=now() from sums s where w.user_id=s.user_id returning s.coin
  ) select coalesce(sum(coin),0)::integer into paid from updated;
  return paid;
end;
$$;
create function game_private.settle_due_weekly_awards() returns integer
language plpgsql security definer set search_path='' as $$
declare entry record; total integer:=0; cutoff date:=date_trunc('week',(clock_timestamp()-interval '5 minutes') at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  for entry in select distinct week_start from game_private.weekly_scores where week_start<cutoff and week_start not in (select week_start from game_private.weekly_settlements) order by week_start
  loop total:=total+game_private.settle_weekly_awards(entry.week_start); end loop;
  return total;
end;
$$;
revoke all on function game_private.settle_weekly_awards(date),game_private.settle_due_weekly_awards() from public,anon,authenticated;
