-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view lunch signups" ON public.lunch_signups;

-- Create a new policy that actually requires authentication
CREATE POLICY "Authenticated users can view lunch signups" 
ON public.lunch_signups 
FOR SELECT 
USING (auth.role() = 'authenticated');