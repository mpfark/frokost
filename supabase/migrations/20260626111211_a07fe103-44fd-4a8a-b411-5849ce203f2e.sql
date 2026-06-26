-- 1. Truncate the cron run history (3.25 GB of bloat)
TRUNCATE TABLE cron.job_run_details;

-- 2. Schedule nightly cleanup keeping only last 7 days of cron history
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  FOR v_jobid IN SELECT jobid FROM cron.job WHERE jobname = 'cleanup-cron-history' LOOP
    PERFORM cron.unschedule(v_jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-cron-history',
  '0 2 * * *',  -- 03:00 Europe/Copenhagen (winter) / 04:00 (summer) — uncritical
  $$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days' $$
);