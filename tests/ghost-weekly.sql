-- Test users and rewards are rolled back, including all wallet changes.
begin;
select set_config('test.g1',gen_random_uuid()::text,true),set_config('test.g2',gen_random_uuid()::text,true),set_config('test.g3',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('test.g1')::uuid,current_setting('test.g1')||'@example.invalid',jsonb_build_object('username','G'||replace(substr(current_setting('test.g1'),1,18),'-',''))),
 (current_setting('test.g2')::uuid,current_setting('test.g2')||'@example.invalid',jsonb_build_object('username','H'||replace(substr(current_setting('test.g2'),1,18),'-',''))),
 (current_setting('test.g3')::uuid,current_setting('test.g3')||'@example.invalid',jsonb_build_object('username','I'||replace(substr(current_setting('test.g3'),1,18),'-','')));
update public.player_wallets set candy=499 where user_id=current_setting('test.g1')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.g1'),'role','authenticated','session_id',gen_random_uuid())::text,true);
set local role authenticated;
do $$ begin
  begin perform public.purchase_ghost_token();raise exception 'Insufficient Candy accepted';exception when others then if sqlerrm<>'Not enough Candy' then raise;end if;end;
  begin perform public.claim_ghost_quest();raise exception 'Incomplete quest accepted';exception when others then if sqlerrm<>'Quest is not complete' then raise;end if;end;
end $$;
reset role;
update public.player_wallets set candy=650 where user_id=current_setting('test.g1')::uuid;
insert into public.player_entities(user_id,entity_id) values(current_setting('test.g1')::uuid,'Witch');
set local role authenticated;
select public.purchase_ghost_token();select public.purchase_ghost_token();
do $$ begin
  if (select candy from public.player_wallets where user_id=current_setting('test.g1')::uuid)<>150 then raise exception 'Token charged twice';end if;
  if not (public.ghost_state()->>'purchased')::boolean then raise exception 'Token not owned';end if;
  begin perform public.apply_verified_run_v2(gen_random_uuid(),current_setting('test.g1')::uuid,60,1,0,true,true);raise exception 'Untrusted client could award token';exception when insufficient_privilege then null;end;
end $$;
select set_config('test.ghost_run',public.start_game('Halloween','Nightmare','Witch',60,960)::text,true);
do $$ begin
  if not (current_setting('test.ghost_run')::jsonb->>'ghost_eligible')::boolean then raise exception 'Eligible Witch run not enabled';end if;
  if (public.start_game('Halloween','Nightmare','Bat',60,960)->>'ghost_eligible')::boolean then raise exception 'Bat run incorrectly eligible';end if;
  if (public.start_game('Halloween','Hard','Witch',60,960)->>'ghost_eligible')::boolean then raise exception 'Wrong difficulty eligible';end if;
end $$;
reset role;
set local role service_role;
select public.apply_verified_run_v2((current_setting('test.ghost_run')::jsonb->>'id')::uuid,current_setting('test.g1')::uuid,60,3,0,true,true);
reset role;
set local role authenticated;
do $$ begin
  if not (public.ghost_state()->>'found')::boolean then raise exception 'Verified token not recorded';end if;
  perform public.claim_ghost_quest();perform public.claim_ghost_quest();
  if not (public.ghost_state()->>'claimed')::boolean then raise exception 'Ghost not claimed';end if;
  if (select count(*) from public.player_entities where user_id=current_setting('test.g1')::uuid and entity_id='Ghost')<>1 then raise exception 'Ghost not unlocked once';end if;
end $$;
reset role;
select set_config('test.late_run',gen_random_uuid()::text,true);
insert into game_private.game_sessions(id,user_id,map_name,difficulty,entity_id,physics_fps,viewport_width,seed,started_at)
  values(current_setting('test.late_run')::uuid,current_setting('test.g1')::uuid,'Halloween','Hard','Bat',60,960,123,((date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '2 weeks') at time zone 'Asia/Ho_Chi_Minh'));
update game_private.game_sessions set last_tick=60,last_score=4 where id=current_setting('test.late_run')::uuid;
do $$ begin if exists(select 1 from game_private.weekly_scores where user_id=current_setting('test.g1')::uuid and difficulty='Hard') then raise exception 'Late replay changed a closed leaderboard';end if;end $$;
insert into game_private.weekly_scores(week_start,user_id,map_name,difficulty,score,achieved_at)
select date '1970-01-05',v.user_id,'Halloween',d.difficulty,v.score,now()
from (values(current_setting('test.g1')::uuid,30),(current_setting('test.g2')::uuid,20),(current_setting('test.g3')::uuid,10)) v(user_id,score)
cross join (values('Easy'),('Nightmare')) d(difficulty);
do $$ declare w date:=date '1970-01-05';begin
  if (game_private.weekly_reward('Easy',1),game_private.weekly_reward('Easy',2),game_private.weekly_reward('Easy',3))<>(25,20,15)
    or (game_private.weekly_reward('Medium',1),game_private.weekly_reward('Medium',2),game_private.weekly_reward('Medium',3))<>(50,35,20)
    or (game_private.weekly_reward('Hard',1),game_private.weekly_reward('Hard',2),game_private.weekly_reward('Hard',3))<>(65,50,35)
    or (game_private.weekly_reward('Extreme',1),game_private.weekly_reward('Extreme',2),game_private.weekly_reward('Extreme',3))<>(80,65,50)
    or (game_private.weekly_reward('Nightmare',1),game_private.weekly_reward('Nightmare',2),game_private.weekly_reward('Nightmare',3))<>(100,75,50) then raise exception 'Reward table wrong';end if;
  if game_private.settle_weekly_awards(w)<>285 then raise exception 'Weekly total incorrect';end if;
  if game_private.settle_weekly_awards(w)<>0 then raise exception 'Weekly payout duplicated';end if;
  if (select coin from public.player_wallets where user_id=current_setting('test.g1')::uuid)<>125 then raise exception 'First place payout wrong';end if;
  if (select coin from public.player_wallets where user_id=current_setting('test.g2')::uuid)<>95 then raise exception 'Second place payout wrong';end if;
  if (select coin from public.player_wallets where user_id=current_setting('test.g3')::uuid)<>65 then raise exception 'Third place payout wrong';end if;
  if jsonb_array_length(public.leaderboard('Halloween','Easy')->'rewards')<>3 then raise exception 'Leaderboard rewards missing';end if;
end $$;
rollback;
