-- Generated fixtures are rolled back and do not change existing accounts.
begin;
select set_config('test.first',gen_random_uuid()::text,true);
select set_config('test.second',gen_random_uuid()::text,true);
select set_config('test.name','U'||replace(substr(current_setting('test.first'),1,18),'-',''),true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('test.first')::uuid,current_setting('test.first')||'@example.invalid',jsonb_build_object('username',current_setting('test.name'))),
 (current_setting('test.second')::uuid,current_setting('test.second')||'@example.invalid',jsonb_build_object('username','V'||replace(substr(current_setting('test.second'),1,18),'-','')));
do $$
begin
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'duplicate@example.invalid',jsonb_build_object('username',lower(current_setting('test.name'))));
    raise exception 'case-insensitive username duplicate accepted';
  exception when unique_violation then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.first'),'role','authenticated','session_id',gen_random_uuid())::text,true);
set local role authenticated;
do $$
declare n integer;
begin
  select count(*) into n from public.profiles;
  if n<>1 then raise exception 'profiles RLS exposed another user'; end if;
  update public.profiles set display_name='Unauthorized' where id=current_setting('test.second')::uuid;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'another profile was modified'; end if;
  update public.profiles set display_name='Visible Name' where id=current_setting('test.first')::uuid;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'own display-name update failed'; end if;
  begin update public.player_wallets set candy=999 where user_id=current_setting('test.first')::uuid;raise exception 'wallet update unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin insert into game_private.admin_roles(user_id) values(current_setting('test.first')::uuid);raise exception 'admin role insertion unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.apply_verified_run(gen_random_uuid(),current_setting('test.first')::uuid,60,999,999,true);raise exception 'direct reward submission unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
