const { PGlite } = require(process.env.PGLITE_MODULE || '../.tools/pglite/package/dist/index.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const sql=name=>fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
    create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
  `);
  for(const name of ['20261029134131_base_accounts_and_economy.sql','20261029134418_daily_weekly_quests.sql','20261029134636_verified_runs_and_leaderboard.sql','20261029134901_verified_run_rewards.sql','20261029140238_profile_display_name_safe.sql'])await db.exec(sql(name));
  await db.exec(`
    insert into auth.users(id,email,raw_user_meta_data) values('11111111-1111-4111-8111-111111111111','existing@example.invalid','{"username":"ExistingPlayer"}');
    update public.player_wallets set coin=42,candy=13 where user_id='11111111-1111-4111-8111-111111111111';
    insert into game_private.leaderboard_scores(user_id,map_name,difficulty,score) values('11111111-1111-4111-8111-111111111111','Halloween','Easy',9);
  `);
  const before=await db.query(`select p.id,p.username,p.display_name,w.coin,w.candy,l.score from public.profiles p join public.player_wallets w on w.user_id=p.id join game_private.leaderboard_scores l on l.user_id=p.id`);
  await db.exec(sql('20261029142555_quest_period_boundary.sql'));
  await db.exec(sql('20261030041711_one_time_witch_shop.sql'));
  await db.exec(sql('20261030042512_bulk_candy_exchange.sql'));
  await db.exec(sql('20261030043049_candy_exchange_ten_daily.sql'));
  await db.exec(sql('20261030053455_ghost_quest_and_weekly_scores.sql'));
  await db.exec(sql('20261030053719_weekly_late_submission_cutoff.sql'));
  await db.exec(sql('20261030163200_candy_to_coin.sql'));
  const after=await db.query(`select p.id,p.username,p.display_name,w.coin,w.candy,l.score from public.profiles p join public.player_wallets w on w.user_id=p.id join game_private.leaderboard_scores l on l.user_id=p.id`);
  assert.deepEqual(after.rows,before.rows,'migration must preserve existing accounts, wallet and leaderboard');
  await db.exec(fs.readFileSync(path.join(root,'tests/witch-shop.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(root,'tests/bulk-exchange.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(root,'tests/candy-coin.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(root,'tests/ghost-weekly.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(root,'tests/supabase-transaction.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(root,'tests/security-rls.sql'),'utf8'));
  await db.exec(`
    begin;
    select set_config('test.player',gen_random_uuid()::text,true);
    select set_config('test.sid',gen_random_uuid()::text,true);
    insert into auth.users(id,email,raw_user_meta_data) values(current_setting('test.player')::uuid,'boundary@example.invalid','{"username":"BoundaryPlayer"}');
    select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.player'),'role','authenticated','session_id',current_setting('test.sid'))::text,true);
    set local role authenticated;
    select set_config('test.run',public.start_game('Halloween','Easy','Bat',60,960)::text,true);
    select public.quest_state('daily');
    select public.quest_state('weekly');
    reset role;
    update game_private.game_sessions set
      started_at=((date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '1 second') at time zone 'Asia/Ho_Chi_Minh'),
      quest_cutoff_at=(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh')
      where id=(current_setting('test.run')::jsonb->>'id')::uuid;
    select game_private.ensure_quests_for_day(current_setting('test.player')::uuid,(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '1 day')::date);
    update game_private.quest_assignments a set progress=q.target-1 from game_private.quest_definitions q
      where a.user_id=current_setting('test.player')::uuid and a.quest_id=q.id and q.difficulty<>'summary'
      and a.period_start in ((date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '1 day')::date,(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '7 days')::date);
    set local role service_role;
    select public.apply_verified_run((current_setting('test.run')::jsonb->>'id')::uuid,current_setting('test.player')::uuid,60,1000,1000,true);
    select public.apply_verified_run((current_setting('test.run')::jsonb->>'id')::uuid,current_setting('test.player')::uuid,60,1000,1000,true);
    reset role;
    do $$ declare p uuid:=current_setting('test.player')::uuid; oldday date:=(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')-interval '1 day')::date;
      oldweek date:=date_trunc('week',oldday::timestamp)::date; paid integer; credits bigint;
    begin
      if not exists(select 1 from game_private.quest_assignments where user_id=p and period_start=oldday and claimed_at is not null) then raise exception 'late daily rewards not settled'; end if;
      if not exists(select 1 from game_private.quest_assignments where user_id=p and period_start=oldweek and claimed_at is not null) then raise exception 'late weekly rewards not settled'; end if;
      if exists(select 1 from game_private.quest_assignments a join game_private.quest_definitions q on q.id=a.quest_id where a.user_id=p and a.progress<>0 and ((q.period='daily' and a.period_start=(now() at time zone 'Asia/Ho_Chi_Minh')::date) or (q.period='weekly' and a.period_start=date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')::date))) then raise exception 'prior-period progress leaked into current quests'; end if;
      select coalesce(sum(reward),0) into paid from game_private.quest_claims where user_id=p;
      select coin into credits from public.player_wallets where user_id=p;
      if credits<>paid or credits=0 then raise exception 'expired rewards duplicated or lost'; end if;
      begin perform game_private.apply_verified_run_impl((current_setting('test.run')::jsonb->>'id')::uuid,p,120,4,2,false);raise exception 'boundary unexpectedly crossed';
      exception when others then if sqlerrm<>'Game session crossed the daily reset' then raise; end if;end;
    end $$;
    rollback;
  `);
  const special=await db.query('select count(*)::int as count from game_private.special_quest_definitions');
  assert.equal(special.rows[0].count,0);
  console.log('Postgres migration and transactional checks passed: preservation, rewards, daily/weekly boundary, late sync, Special');
 }finally{await db.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
