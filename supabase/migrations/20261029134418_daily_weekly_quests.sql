create table game_private.quest_definitions (
  id text primary key,
  period text not null check (period in ('daily','weekly')),
  difficulty text not null check (difficulty in ('easy','medium','hard','summary')),
  title text not null,
  metric text not null,
  target integer not null check (target > 0),
  reward integer not null check (reward > 0),
  active boolean not null default true
);

insert into game_private.quest_definitions (id,period,difficulty,title,metric,target,reward) values
('d01','daily','easy','Play a game','games_started',1,10),
('d02','daily','easy','Complete a game','games_completed',1,10),
('d03','daily','easy','Collect 3 Candies','candy',3,10),
('d04','daily','easy','Score 2 in one run','best_score',2,10),
('d05','daily','easy','Survive 15 seconds in total','survival_seconds',15,10),
('d06','daily','medium','Play 2 games','games_started',2,14),
('d07','daily','medium','Collect 7 Candies','candy',7,14),
('d08','daily','medium','Score 8 in total','score_total',8,15),
('d09','daily','medium','Survive 45 seconds in total','survival_seconds',45,14),
('d10','daily','medium','Score 5 in one run','best_score',5,15),
('d11','daily','medium','Survive 30 seconds in one run','survival_run',30,15),
('d12','daily','medium','Play 2 Night games','night_games',2,14),
('d13','daily','medium','Complete 3 games','games_completed',3,15),
('d14','daily','medium','Collect 12 Candies','candy',12,15),
('d15','daily','medium','Score 15 in total','score_total',15,16),
('d16','daily','hard','Score 10 in one run','best_score',10,20),
('d17','daily','hard','Survive 60 seconds in one run','survival_run',60,20),
('d18','daily','hard','Collect 20 Candies','candy',20,20),
('d19','daily','hard','Play 5 games','games_started',5,20),
('d20','daily','hard','Score 25 in total','score_total',25,20),
('daily_complete_all','daily','summary','Complete all Daily Quests','daily_complete_all',4,20),
('w01','weekly','easy','Play 10 games','games_started',10,75),
('w02','weekly','easy','Complete 10 games','games_completed',10,75),
('w03','weekly','easy','Collect 35 Candies','candy',35,75),
('w04','weekly','easy','Score 50 in total','score_total',50,75),
('w05','weekly','easy','Survive 5 minutes in total','survival_seconds',300,75),
('w06','weekly','easy','Score 15 in one run','best_score',15,75),
('w07','weekly','easy','Play 10 Night games','night_games',10,75),
('w08','weekly','medium','Play 25 games','games_started',25,85),
('w09','weekly','medium','Collect 100 Candies','candy',100,85),
('w10','weekly','medium','Score 160 in total','score_total',160,85),
('w11','weekly','medium','Survive 15 minutes in total','survival_seconds',900,85),
('w12','weekly','medium','Score 25 in one run','best_score',25,85),
('w13','weekly','medium','Complete 20 games','games_completed',20,85),
('w14','weekly','medium','Play 20 Night games','night_games',20,85),
('w15','weekly','hard','Play 50 games','games_started',50,95),
('w16','weekly','hard','Collect 200 Candies','candy',200,95),
('w17','weekly','hard','Score 300 in total','score_total',300,95),
('w18','weekly','hard','Survive 30 minutes in total','survival_seconds',1800,95),
('w19','weekly','hard','Score 40 in one run','best_score',40,95),
('w20','weekly','hard','Survive 120 seconds in one run','survival_run',120,95);

create table game_private.quest_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  quest_id text not null references game_private.quest_definitions(id),
  progress bigint not null default 0 check (progress >= 0),
  claimed_at timestamptz,
  primary key (user_id,period_start,quest_id)
);
create index quest_assignments_period on game_private.quest_assignments (user_id,period_start);
create table game_private.quest_claims (
  user_id uuid not null,
  period_start date not null,
  quest_id text not null,
  reward integer not null check (reward > 0),
  claimed_at timestamptz not null default now(),
  primary key (user_id,period_start,quest_id),
  foreign key (user_id,period_start,quest_id) references game_private.quest_assignments(user_id,period_start,quest_id) on delete cascade
);
alter table game_private.quest_definitions enable row level security;
alter table game_private.quest_assignments enable row level security;
alter table game_private.quest_claims enable row level security;
revoke all on game_private.quest_definitions,game_private.quest_assignments,game_private.quest_claims from public,anon,authenticated;

create function game_private.ensure_quests(player_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare local_now timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  today date := local_now::date; week_start date := date_trunc('week',local_now)::date;
begin
  if player_id is null or player_id is distinct from auth.uid() then raise exception 'Sign in required' using errcode='42501'; end if;
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

create function game_private.quest_state_impl(period_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare player_id uuid := auth.uid(); local_now timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  start_date date; reset_date date; items jsonb; wallet public.player_wallets%rowtype;
begin
  if player_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if period_name not in ('daily','weekly') then raise exception 'Invalid quest period'; end if;
  start_date:=case when period_name='daily' then local_now::date else date_trunc('week',local_now)::date end;
  reset_date:=case when period_name='daily' then start_date+1 else start_date+7 end;
  perform game_private.ensure_quests(player_id);
  select * into wallet from public.player_wallets where user_id=player_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'difficulty',q.difficulty,
    'progress',least(q.target,case when q.difficulty='summary' then
      (select count(*) from game_private.quest_assignments a2 join game_private.quest_definitions q2 on q2.id=a2.quest_id
       where a2.user_id=player_id and a2.period_start=start_date and q2.period='daily' and q2.difficulty<>'summary' and a2.progress>=q2.target)
      else a.progress end),'target',q.target,'reward',q.reward,'claimed',a.claimed_at is not null)
    order by case q.difficulty when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 else 4 end,q.id),'[]'::jsonb)
  into items from game_private.quest_assignments a join game_private.quest_definitions q on q.id=a.quest_id
  where a.user_id=player_id and a.period_start=start_date and q.period=period_name;
  return jsonb_build_object('period',period_name,'server_time',now(),
    'reset_at',(reset_date::timestamp at time zone 'Asia/Ho_Chi_Minh'),'coin',wallet.coin,'candy',wallet.candy,'quests',items);
end;
$$;

create function game_private.claim_quests_impl(period_name text, chosen_id text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare player_id uuid := auth.uid(); local_now timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  start_date date; total integer := 0; entry record; completed bigint;
begin
  if player_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if period_name not in ('daily','weekly') then raise exception 'Invalid quest period'; end if;
  start_date:=case when period_name='daily' then local_now::date else date_trunc('week',local_now)::date end;
  perform game_private.ensure_quests(player_id);
  perform 1 from public.player_wallets where user_id=player_id for update;
  if not found then raise exception 'Player wallet not found'; end if;
  for entry in select a.quest_id,a.progress,q.target,q.reward,q.difficulty from game_private.quest_assignments a
    join game_private.quest_definitions q on q.id=a.quest_id
    where a.user_id=player_id and a.period_start=start_date and q.period=period_name and a.claimed_at is null
      and (chosen_id is null or a.quest_id=chosen_id)
  loop
    completed:=entry.progress;
    if entry.difficulty='summary' then
      select count(*) into completed from game_private.quest_assignments a2 join game_private.quest_definitions q2 on q2.id=a2.quest_id
      where a2.user_id=player_id and a2.period_start=start_date and q2.period='daily' and q2.difficulty<>'summary' and a2.progress>=q2.target;
    end if;
    if completed>=entry.target then
      insert into game_private.quest_claims (user_id,period_start,quest_id,reward) values(player_id,start_date,entry.quest_id,entry.reward) on conflict do nothing;
      if found then
        update game_private.quest_assignments set claimed_at=now() where user_id=player_id and period_start=start_date and quest_id=entry.quest_id;
        total:=total+entry.reward;
      end if;
    end if;
  end loop;
  if total>0 then update public.player_wallets set coin=coin+total,updated_at=now() where user_id=player_id; end if;
  return game_private.quest_state_impl(period_name)||jsonb_build_object('reward_received',total);
end;
$$;
revoke all on function game_private.ensure_quests(uuid),game_private.quest_state_impl(text),game_private.claim_quests_impl(text,text) from public,anon,authenticated;
grant execute on function game_private.quest_state_impl(text),game_private.claim_quests_impl(text,text) to authenticated;
create function public.quest_state(period_name text) returns jsonb language sql security invoker set search_path='' as $$select game_private.quest_state_impl(period_name);$$;
create function public.claim_quests(period_name text,chosen_id text default null) returns jsonb language sql security invoker set search_path='' as $$select game_private.claim_quests_impl(period_name,chosen_id);$$;
revoke all on function public.quest_state(text),public.claim_quests(text,text) from public,anon;
grant execute on function public.quest_state(text),public.claim_quests(text,text) to authenticated;
