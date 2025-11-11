-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can view company settings" ON public.company_settings;

-- Create a new policy allowing anyone to read company settings
-- This is safe because company_settings only contains the allowed domain for signup validation
CREATE POLICY "Anyone can view company settings"
  ON public.company_settings
  FOR SELECT
  USING (true);