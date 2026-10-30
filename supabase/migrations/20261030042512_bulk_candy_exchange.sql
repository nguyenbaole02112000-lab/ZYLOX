-- Adds idempotent bulk exchanges without modifying existing player data.
create table game_private.bulk_exchange_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  item_id text not null references public.shop_items(id),
  quantity integer not null check (quantity between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id,request_id)
);
alter table game_private.bulk_exchange_requests enable row level security;
revoke all on game_private.bulk_exchange_requests from public,anon,authenticated;

create function game_private.exchange_candy_bulk_impl(item_key text, quantity integer, operation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare player_id uuid:=auth.uid(); previous game_private.bulk_exchange_requests%rowtype; i integer;
begin
  if player_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'A registered account is required' using errcode='42501'; end if;
  if item_key is null or quantity is null or quantity<1 or quantity>5 or operation_id is null then raise exception 'Invalid exchange quantity'; end if;
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
revoke all on function game_private.exchange_candy_bulk_impl(text,integer,uuid) from public,anon,authenticated;
grant execute on function game_private.exchange_candy_bulk_impl(text,integer,uuid) to authenticated;
create function public.exchange_candy_bulk(item_key text,quantity integer,operation_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select game_private.exchange_candy_bulk_impl(item_key,quantity,operation_id); $$;
revoke all on function public.exchange_candy_bulk(text,integer,uuid) from public,anon,authenticated;
grant execute on function public.exchange_candy_bulk(text,integer,uuid) to authenticated;
