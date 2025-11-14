-- Add policy for admins to delete any signup
CREATE POLICY "Admins can delete any signup"
ON public.lunch_signups
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));