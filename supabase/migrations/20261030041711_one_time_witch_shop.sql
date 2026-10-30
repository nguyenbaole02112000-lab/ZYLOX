-- Adds a purchase operation only. Existing wallets, accounts and scores are unchanged.
create function game_private.purchase_witch_impl() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare player_id uuid := auth.uid(); balance bigint;
begin
  if player_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'A registered account is required' using errcode='42501';
  end if;
  select candy into balance from public.player_wallets where user_id=player_id for update;
  if not found then raise exception 'Player wallet not found'; end if;
  if exists(select 1 from public.player_entities where user_id=player_id and entity_id='Witch') then
    return jsonb_build_object('owned',true,'candy',balance);
  end if;
  if balance < 200 then raise exception 'Not enough Candy'; end if;
  update public.player_wallets set candy=candy-200,updated_at=now() where user_id=player_id;
  insert into public.player_entities(user_id,entity_id) values(player_id,'Witch');
  return jsonb_build_object('owned',true,'candy',balance-200);
end;
$$;
revoke all on function game_private.purchase_witch_impl() from public,anon,authenticated;
grant execute on function game_private.purchase_witch_impl() to authenticated;

create function public.purchase_witch() returns jsonb
language sql security invoker set search_path = '' as $$ select game_private.purchase_witch_impl(); $$;
revoke all on function public.purchase_witch() from public,anon,authenticated;
grant execute on function public.purchase_witch() to authenticated;
