-- All accounts, balances and purchases in this test are rolled back.
begin;
select set_config('test.bulk_player',gen_random_uuid()::text,true);
select set_config('test.bulk_id',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values(current_setting('test.bulk_player')::uuid,current_setting('test.bulk_player')||'@example.invalid',jsonb_build_object('username','B'||replace(substr(current_setting('test.bulk_player'),1,18),'-','')));
update public.player_wallets set coin=120,candy=2 where user_id=current_setting('test.bulk_player')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.bulk_player'),'role','authenticated')::text,true);
set local role authenticated;
select public.exchange_candy_bulk('candy_5',3,current_setting('test.bulk_id')::uuid);
select public.exchange_candy_bulk('candy_5',3,current_setting('test.bulk_id')::uuid);
do $$ declare state jsonb; begin
  state:=public.shop_state();
  if (state->>'coin')::int<>90 or (state->>'candy')::int<>17 or (state->'items'->0->>'purchased')::int<>3 then raise exception 'Bulk exchange incorrect or duplicated';end if;
  begin perform public.exchange_candy_bulk('candy_5',2,current_setting('test.bulk_id')::uuid);raise exception 'Changed retry accepted';exception when others then if sqlerrm<>'Operation ID already used for a different exchange' then raise;end if;end;
  begin perform public.exchange_candy_bulk('candy_5',8,gen_random_uuid());raise exception 'Over-limit exchange accepted';exception when others then if sqlerrm<>'Daily limit reached' then raise;end if;end;
  state:=public.shop_state();if (state->>'coin')::int<>90 or (state->>'candy')::int<>17 or (state->'items'->0->>'purchased')::int<>3 then raise exception 'Failed exchange was not rolled back';end if;
  perform public.exchange_candy('candy_5',gen_random_uuid());
  perform public.exchange_candy_bulk('candy_5',6,gen_random_uuid());
  if (public.shop_state()->'items'->0->>'purchased')::int<>10 then raise exception 'Single and bulk limits diverged';end if;
end $$;
reset role;
select set_config('test.bulk_ten',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values(current_setting('test.bulk_ten')::uuid,current_setting('test.bulk_ten')||'@example.invalid',jsonb_build_object('username','C'||replace(substr(current_setting('test.bulk_ten'),1,18),'-','')));
update public.player_wallets set coin=100 where user_id=current_setting('test.bulk_ten')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.bulk_ten'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare state jsonb; operation uuid:=gen_random_uuid(); begin
  perform public.exchange_candy_bulk('candy_5',10,operation);
  perform public.exchange_candy_bulk('candy_5',10,operation);
  state:=public.shop_state();
  if (state->>'coin')::int<>0 or (state->>'candy')::int<>50 or (state->'items'->0->>'purchased')::int<>10 then raise exception 'Ten exchanges in one request failed';end if;
  begin perform public.exchange_candy_bulk('candy_5',11,gen_random_uuid());raise exception 'Invalid quantity accepted';exception when others then if sqlerrm<>'Invalid exchange quantity' then raise;end if;end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.exchange_candy_bulk('candy_5',1,gen_random_uuid());raise exception 'Anonymous exchange accepted';exception when insufficient_privilege then null;end;
end $$;
rollback;
