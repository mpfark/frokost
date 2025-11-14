-- Add policy for admins to delete any guest
CREATE POLICY "Admins can delete any guest"
ON public.guests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));