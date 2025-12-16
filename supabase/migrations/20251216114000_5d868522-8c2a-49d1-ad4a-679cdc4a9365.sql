-- Drop the existing SELECT policy that gives kitchen staff access to all profiles
DROP POLICY IF EXISTS "Users can view authorized profiles only" ON public.profiles;

-- Create new policy: Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create separate policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));