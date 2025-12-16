-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Anyone can view company settings" ON public.company_settings;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view company settings"
ON public.company_settings
FOR SELECT
TO authenticated
USING (true);