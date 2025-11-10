-- Update existing policies to also allow kitchen users to manage closed dates
DROP POLICY IF EXISTS "Admins can insert closed dates" ON public.closed_dates;
DROP POLICY IF EXISTS "Admins can delete closed dates" ON public.closed_dates;

CREATE POLICY "Admins and kitchen users can insert closed dates"
ON public.closed_dates
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'kitchen'));

CREATE POLICY "Admins and kitchen users can delete closed dates"
ON public.closed_dates
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'kitchen'));