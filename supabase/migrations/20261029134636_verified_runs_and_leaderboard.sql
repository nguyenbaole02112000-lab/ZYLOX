create table game_private.admin_modes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id,session_id)
);
alter table game_private.admin_modes enable row level security;
revoke all on game_private.admin_modes from public,anon,authenticated;

create table game_private.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  map_name text not null,
  difficulty text not null,
  entity_id text not null references public.entity_definitions(id),
  physics_fps integer not null check (physics_fps in (60,90,120)),
  viewport_width numeric not null check (viewport_width between 160 and 3840),
  seed integer not null check (seed > 0),
  admin_mode boolean not null default false,
  started_at timestamptz not null default clock_timestamp(),
  last_tick integer not null default 0 check (last_tick>=0),
  last_score integer not null default 0 check (last_score>=0),
  last_candy integer not null default 0 check (last_candy>=0),
  started_counted boolean not null default false,
  completed_at timestamptz
);
create index game_sessions_user_started on game_private.game_sessions (user_id,started_at desc);
alter table game_private.game_sessions enable row level security;
revoke all on game_private.game_sessions from public,anon,authenticated;

create table game_private.leaderboard_scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  map_name text not null,
  difficulty text not null,
  score integer not null check (score>=0),
  achieved_at timestamptz not null default now(),
  primary key (user_id,map_name,difficulty)
);
create index leaderboard_rank on game_private.leaderboard_scores (map_name,difficulty,score desc,achieved_at,user_id);
alter table game_private.leaderboard_scores enable row level security;
revoke all on game_private.leaderboard_scores from public,anon,authenticated;

create function game_private.admin_state_impl() returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); sid uuid; admin boolean; enabled boolean:=false;
begin
  if player_id is null then return jsonb_build_object('is_admin',false,'enabled',false); end if;
  begin sid:=nullif(auth.jwt()->>'session_id','')::uuid; exception when invalid_text_representation then sid:=null; end;
  select exists(select 1 from game_private.admin_roles where user_id=player_id) into admin;
  if admin and sid is not null then select coalesce((select m.enabled from game_private.admin_modes m where m.user_id=player_id and m.session_id=sid),false) into enabled; end if;
  return jsonb_build_object('is_admin',admin,'enabled',enabled);
end;
$$;

create function game_private.set_admin_mode_impl(desired boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); sid uuid;
begin
  if player_id is null or not exists(select 1 from game_private.admin_roles where user_id=player_id) then raise exception 'Admin access required' using errcode='42501'; end if;
  begin sid:=nullif(auth.jwt()->>'session_id','')::uuid; exception when invalid_text_representation then sid:=null; end;
  if sid is null then raise exception 'Authenticated session required' using errcode='42501'; end if;
  insert into game_private.admin_modes(user_id,session_id,enabled) values(player_id,sid,coalesce(desired,false))
  on conflict(user_id,session_id) do update set enabled=excluded.enabled,updated_at=now();
  return game_private.admin_state_impl();
end;
$$;

create function game_private.start_run_impl(map_key text,difficulty_key text,entity_key text,fps integer,width_value numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); admin_on boolean; run game_private.game_sessions%rowtype;
begin
  if player_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'A registered account is required' using errcode='42501'; end if;
  if map_key<>'Halloween' or difficulty_key not in ('Easy','Medium','Hard','Extreme','Nightmare') then raise exception 'Map or difficulty unavailable'; end if;
  if fps not in (60,90,120) or width_value is null or width_value<160 or width_value>3840 then raise exception 'Invalid game settings'; end if;
  admin_on:=coalesce((game_private.admin_state_impl()->>'enabled')::boolean,false);
  if not exists(select 1 from public.player_entities where user_id=player_id and entity_id=entity_key) and not admin_on then raise exception 'Entity is locked'; end if;
  if entity_key not in ('Bat','Witch','Ghost') then raise exception 'Unknown entity'; end if;
  if (select count(*) from game_private.game_sessions where user_id=player_id and started_at>clock_timestamp()-interval '1 minute')>=20 then raise exception 'Too many new games'; end if;
  insert into game_private.game_sessions(user_id,map_name,difficulty,entity_id,physics_fps,viewport_width,seed,admin_mode)
  values(player_id,map_key,difficulty_key,entity_key,fps,width_value,(random()*2147483645)::integer+1,admin_on) returning * into run;
  return jsonb_build_object('id',run.id,'seed',run.seed,'started_at',run.started_at,'admin_mode',run.admin_mode,
    'map',run.map_name,'difficulty',run.difficulty,'entity',run.entity_id,'fps',run.physics_fps,'width',run.viewport_width);
end;
$$;

create function game_private.run_challenge_impl(run_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); run game_private.game_sessions%rowtype;
begin
  if player_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select * into run from game_private.game_sessions where id=run_id and user_id=player_id;
  if not found then raise exception 'Game session not found'; end if;
  return jsonb_build_object('id',run.id,'seed',run.seed,'started_at',run.started_at,'completed_at',run.completed_at,
    'map',run.map_name,'difficulty',run.difficulty,'entity',run.entity_id,'fps',run.physics_fps,'width',run.viewport_width,'admin_mode',run.admin_mode);
end;
$$;

create function game_private.leaderboard_impl(map_key text,difficulty_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare player_id uuid:=auth.uid(); answer jsonb;
begin
  if map_key is null or length(map_key)>32 or difficulty_key is null or length(difficulty_key)>32 then raise exception 'Invalid leaderboard'; end if;
  with ranked as (
    select s.user_id,p.username,s.score,row_number() over(order by s.score desc,s.achieved_at,s.user_id) as rank
    from game_private.leaderboard_scores s join public.profiles p on p.id=s.user_id
    where s.map_name=map_key and s.difficulty=difficulty_key
  ) select jsonb_build_object('top',coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'username',username,'score',score) order by rank) from ranked where rank<=50),'[]'::jsonb),
    'me',(select jsonb_build_object('rank',rank,'username',username,'score',score) from ranked where user_id=player_id)) into answer;
  return answer;
end;
$$;

grant usage on schema game_private to anon;
revoke all on function game_private.admin_state_impl(),game_private.set_admin_mode_impl(boolean),game_private.start_run_impl(text,text,text,integer,numeric),game_private.run_challenge_impl(uuid),game_private.leaderboard_impl(text,text) from public,anon,authenticated;
grant execute on function game_private.admin_state_impl(),game_private.set_admin_mode_impl(boolean),game_private.start_run_impl(text,text,text,integer,numeric),game_private.run_challenge_impl(uuid) to authenticated;
grant execute on function game_private.leaderboard_impl(text,text) to anon,authenticated;
create function public.admin_state() returns jsonb language sql security invoker set search_path='' as $$select game_private.admin_state_impl();$$;
create function public.set_admin_mode(desired boolean) returns jsonb language sql security invoker set search_path='' as $$select game_private.set_admin_mode_impl(desired);$$;
create function public.start_game(map_key text,difficulty_key text,entity_key text,fps integer,width_value numeric) returns jsonb language sql security invoker set search_path='' as $$select game_private.start_run_impl(map_key,difficulty_key,entity_key,fps,width_value);$$;
create function public.run_challenge(run_id uuid) returns jsonb language sql security invoker set search_path='' as $$select game_private.run_challenge_impl(run_id);$$;
create function public.leaderboard(map_key text,difficulty_key text) returns jsonb language sql security invoker set search_path='' as $$select game_private.leaderboard_impl(map_key,difficulty_key);$$;
revoke all on function public.admin_state(),public.set_admin_mode(boolean),public.start_game(text,text,text,integer,numeric),public.run_challenge(uuid),public.leaderboard(text,text) from public,anon,authenticated;
grant execute on function public.admin_state(),public.set_admin_mode(boolean),public.start_game(text,text,text,integer,numeric),public.run_challenge(uuid) to authenticated;
grant execute on function public.leaderboard(text,text) to anon,authenticated;
