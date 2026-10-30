-- Add reverse exchanges without changing existing player data or purchase history.
create table game_private.candy_coin_exchanges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  quantity bigint not null check (quantity > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table game_private.candy_coin_exchanges enable row level security;
revoke all on game_private.candy_coin_exchanges from public, anon, authenticated;

create function game_private.exchange_coin_impl(quantity bigint, operation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare player_id uuid:=auth.uid(); wallet public.player_wallets%rowtype; previous game_private.candy_coin_exchanges%rowtype;
begin
  if player_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'A registered account is required' using errcode='42501'; end if;
  if quantity is null or quantity<1 or quantity>4503599627370495 or operation_id is null then raise exception 'Invalid exchange quantity'; end if;
  select * into wallet from public.player_wallets where user_id=player_id for update;
  if not found then raise exception 'Player wallet not found'; end if;
  select * into previous from game_private.candy_coin_exchanges where user_id=player_id and request_id=operation_id;
  if found then
    if previous.quantity<>quantity then raise exception 'Operation ID already used for a different exchange'; end if;
    return game_private.shop_state_impl();
  end if;
  if wallet.candy<quantity then raise exception 'Not enough Candy'; end if;
  if wallet.coin>9007199254740991-quantity*2 then raise exception 'Coin balance is too large'; end if;
  update public.player_wallets set candy=candy-quantity,coin=coin+quantity*2,updated_at=now() where user_id=player_id;
  insert into game_private.candy_coin_exchanges(user_id,request_id,quantity) values(player_id,operation_id,quantity);
  return game_private.shop_state_impl();
end;
$$;
revoke all on function game_private.exchange_coin_impl(bigint,uuid) from public,anon,authenticated;
grant execute on function game_private.exchange_coin_impl(bigint,uuid) to authenticated;
create function public.exchange_coin(quantity bigint,operation_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select game_private.exchange_coin_impl(quantity,operation_id); $$;
revoke all on function public.exchange_coin(bigint,uuid) from public,anon,authenticated;
grant execute on function public.exchange_coin(bigint,uuid) to authenticated;
