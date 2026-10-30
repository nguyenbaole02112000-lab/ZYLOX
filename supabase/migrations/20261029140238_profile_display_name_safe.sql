-- Add display names without replacing existing player data.
alter table public.profiles add column if not exists display_name text;

-- Existing rows are left untouched. The application falls back to username
-- whenever display_name is null.

-- Existing non-null values are preserved. New or updated values must be valid.
alter table public.profiles add constraint profiles_display_name_valid
  check (display_name is null or char_length(trim(display_name)) between 1 and 32) not valid;

-- Only the display_name column may be changed, and only on the player's own row.
grant update (display_name) on public.profiles to authenticated;
create policy profiles_update_display_name on public.profiles for update to authenticated
  using ((select auth.uid())=id) with check ((select auth.uid())=id);

-- The existing signup function remains unchanged; initialize missing names on insert.
create function game_private.initialize_profile_display_name() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.display_name is null then new.display_name := new.username; end if;
  return new;
end;
$$;
revoke all on function game_private.initialize_profile_display_name() from public,anon,authenticated;
create trigger initialize_profile_display_name before insert on public.profiles
  for each row execute function game_private.initialize_profile_display_name();
