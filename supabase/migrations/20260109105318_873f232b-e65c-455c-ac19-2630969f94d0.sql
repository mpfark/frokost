-- Allow kitchen staff to view all profiles (needed for lunch planning)
CREATE POLICY "Kitchen staff can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'kitchen'::app_role));