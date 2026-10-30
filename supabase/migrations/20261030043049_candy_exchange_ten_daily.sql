-- Increase this product's daily limit. Player balances and transaction history are retained.
update public.shop_items set daily_limit=10 where id='candy_5';

-- Replace only the quantity validation rule; existing exchange records remain intact.
alter table game_private.bulk_exchange_requests drop constraint bulk_exchange_requests_quantity_check;
alter table game_private.bulk_exchange_requests add constraint bulk_exchange_requests_quantity_check check (quantity between 1 and 10);

create or replace function game_private.exchange_candy_bulk_impl(item_key text, quantity integer, operation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare player_id uuid:=auth.uid(); previous game_private.bulk_exchange_requests%rowtype; i integer;
begin
  if player_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'A registered account is required' using errcode='42501'; end if;
  if item_key is null or quantity is null or quantity<1 or quantity>10 or operation_id is null then raise exception 'Invalid exchange quantity'; end if;
  perform 1 from public.player_wallets where user_id=player_id for update;
  if not found then raise exception 'Player wallet not found'; end if;
  select * into previous from game_private.bulk_exchange_requests where user_id=player_id and request_id=operation_id;
  if found then
    if previous.item_id<>item_key or previous.quantity<>quantity then raise exception 'Operation ID already used for a different exchange'; end if;
    return game_private.shop_state_impl();
  end if;
  for i in 1..quantity loop
    perform game_private.exchange_candy_impl(item_key,gen_random_uuid());
  end loop;
  insert into game_private.bulk_exchange_requests(user_id,request_id,item_id,quantity) values(player_id,operation_id,item_key,quantity);
  return game_private.shop_state_impl();
end;
$$;
