-- Allow admins to update any signup (for marking absence)
CREATE POLICY "Admins can update any signup" 
ON public.lunch_signups 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow kitchen staff to update any signup (for marking absence)
CREATE POLICY "Kitchen staff can update any signup" 
ON public.lunch_signups 
FOR UPDATE 
USING (has_role(auth.uid(), 'kitchen'::app_role))
WITH CHECK (has_role(auth.uid(), 'kitchen'::app_role));