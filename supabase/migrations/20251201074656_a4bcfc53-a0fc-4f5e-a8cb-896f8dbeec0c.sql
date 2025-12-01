-- Allow postgres user to read cron settings for pg_cron jobs
CREATE POLICY "Postgres user can read cron settings"
ON public.cron_settings
AS PERMISSIVE
FOR SELECT
TO postgres
USING (true);