
-- Create a function to clean up data older than 1 month
CREATE OR REPLACE FUNCTION public.cleanup_old_lunch_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cutoff_date date := (current_date - interval '1 month')::date;
BEGIN
  -- Delete old guests (via cascade from signups)
  DELETE FROM public.guests
  WHERE signup_id IN (
    SELECT id FROM public.lunch_signups WHERE lunch_date < cutoff_date
  );

  -- Delete old lunch signups
  DELETE FROM public.lunch_signups WHERE lunch_date < cutoff_date;

  -- Delete old lunch optouts
  DELETE FROM public.lunch_optouts WHERE lunch_date < cutoff_date;

  -- Delete old audit log entries
  DELETE FROM public.signup_audit_log WHERE lunch_date < cutoff_date;

  RAISE LOG 'Cleaned up lunch data older than %', cutoff_date;
END;
$$;
