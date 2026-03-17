
-- 1. Create a SECURITY DEFINER function to get active user count
CREATE OR REPLACE FUNCTION public.get_active_user_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.profiles
  WHERE is_active = true
    AND reminder_enabled = true
$$;

-- 2. Add RLS policy for all authenticated users to view all optouts
CREATE POLICY "Authenticated users can view all optouts"
ON public.lunch_optouts
FOR SELECT
TO authenticated
USING (true);
