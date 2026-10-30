-- Every five minutes, settle completed weeks after a five-minute sync grace period.
create extension if not exists pg_cron;
select cron.schedule('bao-weekly-leaderboard-awards','*/5 * * * *',
  'select game_private.settle_due_weekly_awards();');
