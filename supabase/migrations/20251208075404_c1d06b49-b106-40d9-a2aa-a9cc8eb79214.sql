-- Drop existing SELECT policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.profiles;
DROP POLICY IF EXISTS "Kitchen staff can view all profiles" ON public.profiles;

-- Create a single PERMISSIVE policy that properly restricts access
CREATE POLICY "Users can view authorized profiles only"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'kitchen'::app_role)
);