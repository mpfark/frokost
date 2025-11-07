-- Drop existing permissive policies that allow any authenticated user
DROP POLICY IF EXISTS "Authenticated users can insert closed dates" ON closed_dates;
DROP POLICY IF EXISTS "Authenticated users can delete closed dates" ON closed_dates;

-- Create admin-only policies for managing closed dates
CREATE POLICY "Admins can insert closed dates"
ON closed_dates FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete closed dates"
ON closed_dates FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));