-- Isolated generated account and synthetic old period; all changes are rolled back.
begin;
select set_config('test.player',gen_random_uuid()::text,true);
select set_config('test.sid',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data)
values(current_setting('test.player')::uuid,'boundary-'||current_setting('test.player')||'@example.invalid',
 jsonb_build_object('username','B'||replace(substr(current_setting('test.player'),1,18),'-','')));
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.player'),'role','authenticated','session_id',current_setting('test.sid'))::text,true);
set local role authenticated;
select set_config('test.run',public.start_game('Halloween','Easy','Bat',60,960)::text,true);
select public.quest_state('daily');
select public.quest_state('weekly');
reset role;
update game_private.game_sessions set
  started_at=((date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '1 second') at time zone 'Asia/Ho_Chi_Minh'),
  quest_cutoff_at=(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh')
  where id=(current_setting('test.run')::jsonb->>'id')::uuid;
select game_private.ensure_quests_for_day(current_setting('test.player')::uuid,(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '1 day')::date);
update game_private.quest_assignments a set progress=q.target-1 from game_private.quest_definitions q
  where a.user_id=current_setting('test.player')::uuid and a.quest_id=q.id and q.difficulty<>'summary'
  and a.period_start in ((date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '1 day')::date,(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '7 days')::date);
set local role service_role;
select public.apply_verified_run((current_setting('test.run')::jsonb->>'id')::uuid,current_setting('test.player')::uuid,60,1000,1000,true);
select public.apply_verified_run((current_setting('test.run')::jsonb->>'id')::uuid,current_setting('test.player')::uuid,60,1000,1000,true);
reset role;
do $$
declare p uuid:=current_setting('test.player')::uuid; oldday date:=(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '1 day')::date;
  oldweek date:=date_trunc('week',oldday::timestamp)::date; paid integer; credits bigint;
begin
  if not exists(select 1 from game_private.quest_assignments where user_id=p and period_start=oldday and claimed_at is not null) then raise exception 'late daily rewards not settled'; end if;
  if not exists(select 1 from game_private.quest_assignments where user_id=p and period_start=oldweek and claimed_at is not null) then raise exception 'late weekly rewards not settled'; end if;
  if exists(select 1 from game_private.quest_assignments a join game_private.quest_definitions q on q.id=a.quest_id where a.user_id=p and a.progress<>0
    and ((q.period='daily' and a.period_start=(now() at time zone 'Asia/Ho_Chi_Minh')::date)
      or (q.period='weekly' and a.period_start=date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')::date))) then raise exception 'prior-period progress leaked into current quests'; end if;
  select coalesce(sum(reward),0) into paid from game_private.quest_claims where user_id=p;
  select coin into credits from public.player_wallets where user_id=p;
  if credits<>paid or credits=0 then raise exception 'expired rewards duplicated or lost'; end if;
  begin perform game_private.apply_verified_run_impl((current_setting('test.run')::jsonb->>'id')::uuid,p,120,4,2,false); raise exception 'boundary unexpectedly crossed';
  exception when others then if sqlerrm<>'Game session crossed the daily reset' then raise; end if; end;
end $$;
rollback;
