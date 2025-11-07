-- Drop the existing public read policy
DROP POLICY IF EXISTS "Anyone can view lunch signups" ON public.lunch_signups;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can view lunch signups"
ON public.lunch_signups
FOR SELECT
TO authenticated
USING (true);