-- Fixture users and transactions are rolled back; real players are untouched.
begin;
select set_config('test.reverse_player',gen_random_uuid()::text,true),set_config('test.reverse_operation',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values(current_setting('test.reverse_player')::uuid,current_setting('test.reverse_player')||'@example.invalid',jsonb_build_object('username','R'||replace(substr(current_setting('test.reverse_player'),1,18),'-','')));
update public.player_wallets set coin=7,candy=200 where user_id=current_setting('test.reverse_player')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.reverse_player'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare state jsonb; i integer; begin
  perform public.exchange_coin(25,current_setting('test.reverse_operation')::uuid);
  perform public.exchange_coin(25,current_setting('test.reverse_operation')::uuid);
  state:=public.shop_state();if (state->>'coin')::int<>57 or (state->>'candy')::int<>175 then raise exception 'Retry duplicated exchange';end if;
  begin perform public.exchange_coin(1,current_setting('test.reverse_operation')::uuid);raise exception 'Changed retry accepted';exception when others then if sqlerrm<>'Operation ID already used for a different exchange' then raise;end if;end;
  begin perform public.exchange_coin(176,gen_random_uuid());raise exception 'Insufficient Candy accepted';exception when others then if sqlerrm<>'Not enough Candy' then raise;end if;end;
  begin perform public.exchange_coin(0,gen_random_uuid());raise exception 'Zero quantity accepted';exception when others then if sqlerrm<>'Invalid exchange quantity' then raise;end if;end;
  for i in 1..11 loop perform public.exchange_coin(1,gen_random_uuid());end loop;
  state:=public.shop_state();if (state->>'coin')::int<>79 or (state->>'candy')::int<>164 then raise exception 'Unlimited exchanges or balance incorrect';end if;
end $$;
reset role;
set local role anon;
do $$ begin begin perform public.exchange_coin(1,gen_random_uuid());raise exception 'Anonymous exchange accepted';exception when insufficient_privilege then null;end;end $$;
rollback;
