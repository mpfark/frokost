CREATE OR REPLACE FUNCTION public.get_active_user_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.profiles p
  WHERE p.is_active = true
    AND p.reminder_enabled = true
$$;

GRANT EXECUTE ON FUNCTION public.get_active_user_count() TO authenticated;