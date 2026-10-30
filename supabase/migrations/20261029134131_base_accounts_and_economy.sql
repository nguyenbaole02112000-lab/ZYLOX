-- Usernames, wallets and daily shop purchases. Private functions validate every mutation.
create schema if not exists game_private;
revoke all on schema game_private from public, anon, authenticated;
grant usage on schema game_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_unique on public.profiles (lower(username));

create table public.player_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coin bigint not null default 0 check (coin >= 0),
  candy bigint not null default 0 check (candy >= 0),
  updated_at timestamptz not null default now()
);

create table public.entity_definitions (
  id text primary key,
  rarity text not null check (rarity in ('Common','Rare','Epic','Legendary','Mythical','Secret')),
  default_unlocked boolean not null default false
);
insert into public.entity_definitions (id,rarity,default_unlocked) values
  ('Bat','Common',true),('Witch','Epic',false),('Ghost','Mythical',false);

create table public.player_entities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_id text not null references public.entity_definitions(id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id,entity_id)
);

create table game_private.admin_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);

create table public.shop_items (
  id text primary key,
  candy_amount integer not null check (candy_amount > 0),
  coin_price integer not null check (coin_price > 0),
  daily_limit integer not null check (daily_limit > 0),
  active boolean not null default true
);
insert into public.shop_items (id,candy_amount,coin_price,daily_limit)
values ('candy_5',5,10,5);

create table game_private.shop_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  item_id text not null references public.shop_items(id),
  shop_day date not null,
  coin_price integer not null check (coin_price > 0),
  candy_amount integer not null check (candy_amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id,request_id)
);
create index shop_transactions_daily on game_private.shop_transactions (user_id,shop_day,item_id);

alter table public.profiles enable row level security;
alter table public.player_wallets enable row level security;
alter table public.entity_definitions enable row level security;
alter table public.player_entities enable row level security;
alter table public.shop_items enable row level security;
alter table game_private.admin_roles enable row level security;
alter table game_private.shop_transactions enable row level security;

revoke all on public.profiles,public.player_wallets,public.entity_definitions,public.player_entities,public.shop_items from public,anon,authenticated;
revoke all on all tables in schema game_private from public,anon,authenticated;
grant select on public.profiles,public.player_wallets,public.entity_definitions,public.player_entities,public.shop_items to authenticated;
create policy profiles_read_own on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy wallet_read_own on public.player_wallets for select to authenticated using ((select auth.uid())=user_id);
create policy entities_read on public.entity_definitions for select to authenticated using (true);
create policy owned_entities_read_own on public.player_entities for select to authenticated using ((select auth.uid())=user_id);
create policy shop_items_read on public.shop_items for select to authenticated using (active);

create function game_private.create_player() returns trigger
language plpgsql security definer set search_path = '' as $$
declare chosen_name text := trim(coalesce(new.raw_user_meta_data->>'username',''));
begin
  if chosen_name !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Username must contain 3–24 letters, numbers, or underscores';
  end if;
  insert into public.profiles (id,username) values (new.id,chosen_name);
  insert into public.player_wallets (user_id) values (new.id);
  insert into public.player_entities (user_id,entity_id) values (new.id,'Bat');
  return new;
end;
$$;
revoke all on function game_private.create_player() from public,anon,authenticated;
create trigger on_fantasy_signup after insert on auth.users for each row execute function game_private.create_player();

create function game_private.shop_state_impl() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare player_id uuid := auth.uid(); today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; result jsonb;
begin
  if player_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select jsonb_build_object('coin',w.coin,'candy',w.candy,'server_time',now(),
    'reset_at',((today+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'coin_price',s.coin_price,
      'candy_amount',s.candy_amount,'daily_limit',s.daily_limit,'purchased',
      (select count(*) from game_private.shop_transactions t where t.user_id=player_id and t.item_id=s.id and t.shop_day=today)))
      from public.shop_items s where s.active),'[]'::jsonb)) into result
  from public.player_wallets w where w.user_id=player_id;
  if result is null then raise exception 'Player wallet not found'; end if;
  return result;
end;
$$;

create function game_private.exchange_candy_impl(item_key text, operation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare player_id uuid := auth.uid(); today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  product public.shop_items%rowtype; wallet public.player_wallets%rowtype; previous game_private.shop_transactions%rowtype; used_count bigint;
begin
  if player_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if operation_id is null then raise exception 'Operation ID required'; end if;
  select * into wallet from public.player_wallets where user_id=player_id for update;
  if not found then raise exception 'Player wallet not found'; end if;
  select * into previous from game_private.shop_transactions where user_id=player_id and request_id=operation_id;
  if found then
    if previous.item_id<>item_key then raise exception 'Operation ID already used for a different item'; end if;
    return game_private.shop_state_impl();
  end if;
  select * into product from public.shop_items where id=item_key and active;
  if not found then raise exception 'Item unavailable'; end if;
  select count(*) into used_count from game_private.shop_transactions where user_id=player_id and item_id=item_key and shop_day=today;
  if used_count>=product.daily_limit then raise exception 'Daily limit reached'; end if;
  if wallet.coin<product.coin_price then raise exception 'Not enough Coins'; end if;
  update public.player_wallets set coin=coin-product.coin_price,candy=candy+product.candy_amount,updated_at=now() where user_id=player_id;
  insert into game_private.shop_transactions (user_id,request_id,item_id,shop_day,coin_price,candy_amount)
  values (player_id,operation_id,item_key,today,product.coin_price,product.candy_amount);
  return game_private.shop_state_impl();
end;
$$;

revoke all on function game_private.shop_state_impl() from public,anon,authenticated;
revoke all on function game_private.exchange_candy_impl(text,uuid) from public,anon,authenticated;
grant execute on function game_private.shop_state_impl(),game_private.exchange_candy_impl(text,uuid) to authenticated;

create function public.shop_state() returns jsonb
language sql security invoker set search_path = '' as $$ select game_private.shop_state_impl(); $$;
create function public.exchange_candy(item_key text, operation_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select game_private.exchange_candy_impl(item_key,operation_id); $$;
revoke all on function public.shop_state(),public.exchange_candy(text,uuid) from public,anon;
grant execute on function public.shop_state(),public.exchange_candy(text,uuid) to authenticated;
