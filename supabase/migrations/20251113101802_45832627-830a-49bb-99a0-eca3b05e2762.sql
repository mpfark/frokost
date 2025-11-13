-- Allow kitchen staff to delete lunch signups
CREATE POLICY "Kitchen staff can delete any signup"
ON public.lunch_signups
FOR DELETE
USING (has_role(auth.uid(), 'kitchen'::app_role));

-- Allow kitchen staff to delete guests
CREATE POLICY "Kitchen staff can delete any guest"
ON public.guests
FOR DELETE
USING (has_role(auth.uid(), 'kitchen'::app_role));