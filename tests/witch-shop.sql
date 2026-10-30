-- All fixtures and purchases in this test are rolled back.
begin;
select set_config('test.witch_player',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values(current_setting('test.witch_player')::uuid,current_setting('test.witch_player')||'@example.invalid',jsonb_build_object('username','W'||replace(substr(current_setting('test.witch_player'),1,18),'-','')));
update public.player_wallets set candy=199,coin=42 where user_id=current_setting('test.witch_player')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.witch_player'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  begin perform public.purchase_witch();raise exception 'Insufficient Candy purchase was accepted';
  exception when others then if sqlerrm<>'Not enough Candy' then raise; end if; end;
end $$;
reset role;
update public.player_wallets set candy=250 where user_id=current_setting('test.witch_player')::uuid;
set local role authenticated;
select public.purchase_witch();
select public.purchase_witch();
do $$ declare balance bigint; coins bigint; n int; begin
  select candy,coin into balance,coins from public.player_wallets where user_id=current_setting('test.witch_player')::uuid;
  select count(*) into n from public.player_entities where user_id=current_setting('test.witch_player')::uuid and entity_id='Witch';
  if balance<>50 or coins<>42 or n<>1 then raise exception 'Purchase or repeated request produced the wrong result'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.purchase_witch(); raise exception 'Anonymous purchase accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
