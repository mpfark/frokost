GRANT SELECT ON public.companies TO anon;

CREATE POLICY "Public can resolve active company domains"
ON public.companies
FOR SELECT
TO anon
USING (is_active = true);