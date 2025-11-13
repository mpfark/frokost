-- Allow kitchen staff to view all profiles so they can see who signed up for lunch
CREATE POLICY "Kitchen staff can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'kitchen'::app_role));