-- Test fixtures exist only within this transaction and are rolled back.
begin;
select set_config('test.player',gen_random_uuid()::text,true);
select set_config('test.sid',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data)
values(current_setting('test.player')::uuid,
  'test-'||current_setting('test.player')||'@example.invalid',
  jsonb_build_object('username','T'||replace(substr(current_setting('test.player'),1,18),'-','')));
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.player'),
  'role','authenticated','session_id',current_setting('test.sid'))::text,true);

do $$
declare p uuid:=current_setting('test.player')::uuid;
begin
  if not exists(select 1 from public.profiles where id=p and display_name=username) then raise exception 'signup profile missing'; end if;
  if not exists(select 1 from public.player_wallets where user_id=p and coin=0 and candy=0) then raise exception 'initial wallet incorrect'; end if;
  if not exists(select 1 from public.player_entities where user_id=p and entity_id='Bat') then raise exception 'default entity missing'; end if;
end $$;

set local role authenticated;
select set_config('test.daily',public.quest_state('daily')::text,true);
select set_config('test.weekly',public.quest_state('weekly')::text,true);
select set_config('test.run',public.start_game('Halloween','Easy','Bat',60,960)::text,true);
do $$
declare weekly jsonb:=current_setting('test.weekly')::jsonb;
begin
  if jsonb_array_length(current_setting('test.daily')::jsonb->'quests')<>5 then raise exception 'wrong daily count'; end if;
  if jsonb_array_length(weekly->'quests')<>6 then raise exception 'wrong weekly count'; end if;
  if (select count(*) from jsonb_array_elements(weekly->'quests') q where q->>'difficulty'='easy')<>2 or
     (select count(*) from jsonb_array_elements(weekly->'quests') q where q->>'difficulty'='medium')<>2 or
     (select count(*) from jsonb_array_elements(weekly->'quests') q where q->>'difficulty'='hard')<>2 then raise exception 'wrong weekly difficulty distribution'; end if;
  if public.quest_state('daily')->'quests'<>current_setting('test.daily')::jsonb->'quests' then raise exception 'daily assignments changed'; end if;
  begin perform public.set_admin_mode(true); raise exception 'admin access unexpectedly allowed'; exception when insufficient_privilege then null; end;
  begin perform public.start_game('Halloween','Easy','Ghost',60,960); raise exception 'locked entity unexpectedly allowed'; exception when others then if sqlerrm<>'Entity is locked' then raise; end if; end;
end $$;
reset role;
set local role service_role;
select public.apply_verified_run((current_setting('test.run')::jsonb->>'id')::uuid,current_setting('test.player')::uuid,60,2,1,true);
select public.apply_verified_run((current_setting('test.run')::jsonb->>'id')::uuid,current_setting('test.player')::uuid,60,2,1,true);
reset role;
insert into game_private.admin_roles(user_id) values(current_setting('test.player')::uuid);
set local role authenticated;
select public.set_admin_mode(true);
select set_config('test.admin_run',public.start_game('Halloween','Hard','Ghost',60,960)::text,true);
reset role;
set local role service_role;
select public.apply_verified_run((current_setting('test.admin_run')::jsonb->>'id')::uuid,current_setting('test.player')::uuid,60,8,3,true);
reset role;
do $$
declare p uuid:=current_setting('test.player')::uuid;
begin
  if not exists(select 1 from public.player_wallets where user_id=p and candy=1) then raise exception 'admin run paid candy'; end if;
  if exists(select 1 from game_private.leaderboard_scores where user_id=p and difficulty='Hard') then raise exception 'admin run entered leaderboard'; end if;
end $$;
set local role authenticated;
select public.set_admin_mode(false);
reset role;
do $$
declare p uuid:=current_setting('test.player')::uuid; n integer;
begin
  if not exists(select 1 from public.player_wallets where user_id=p and coin=0 and candy=1) then raise exception 'verified candy or duplicate handling failed'; end if;
  if not exists(select 1 from game_private.leaderboard_scores where user_id=p and score=2 and map_name='Halloween' and difficulty='Easy') then raise exception 'leaderboard not saved'; end if;
  update game_private.quest_assignments a set progress=q.target from game_private.quest_definitions q where a.user_id=p and a.quest_id=q.id;
end $$;
set local role authenticated;
select set_config('test.claim',public.claim_quests('daily',null)::text,true);
select set_config('test.claim_again',public.claim_quests('daily',null)::text,true);
select set_config('test.exchange_id',gen_random_uuid()::text,true);
select public.exchange_candy('candy_5',current_setting('test.exchange_id')::uuid);
select public.exchange_candy('candy_5',current_setting('test.exchange_id')::uuid);
do $$
declare reward integer:=(current_setting('test.claim')::jsonb->>'reward_received')::integer; wallet jsonb;
begin
  if reward<=0 or (current_setting('test.claim_again')::jsonb->>'reward_received')::integer<>0 then raise exception 'quest claim duplicated'; end if;
  wallet:=public.shop_state();
  if (wallet->>'coin')::integer<>reward-10 or (wallet->>'candy')::integer<>6 then raise exception 'shop exchange duplicated or wallet incorrect'; end if;
  if (wallet->'items'->0->>'purchased')::integer<>1 then raise exception 'shop transaction duplicated'; end if;
  if not (public.leaderboard('Halloween','Easy')->'top' @> jsonb_build_array(jsonb_build_object('score',2))) then raise exception 'leaderboard query incorrect'; end if;
  if jsonb_array_length(public.leaderboard('Halloween','Hard')->'top')<>0 then raise exception 'leaderboards not separated'; end if;
  begin update public.player_wallets set coin=999 where user_id=current_setting('test.player')::uuid; raise exception 'wallet update unexpectedly allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.player_wallets set coin=100 where user_id=current_setting('test.player')::uuid;
set local role authenticated;
do $$
begin
  for i in 1..9 loop perform public.exchange_candy('candy_5',gen_random_uuid()); end loop;
  begin perform public.exchange_candy('candy_5',gen_random_uuid()); raise exception 'shop limit unexpectedly bypassed';
  exception when others then if sqlerrm<>'Daily limit reached' then raise; end if; end;
  if (public.shop_state()->'items'->0->>'purchased')::integer<>10 then raise exception 'daily shop limit incorrect'; end if;
end $$;
select set_config('test.weekly_claim',public.claim_quests('weekly',null)::text,true);
do $$
begin
  if (current_setting('test.weekly_claim')::jsonb->>'reward_received')::integer<=0 then raise exception 'weekly claim failed'; end if;
  if (public.claim_quests('weekly',null)->>'reward_received')::integer<>0 then raise exception 'weekly claim duplicated'; end if;
end $$;
reset role;
rollback;
