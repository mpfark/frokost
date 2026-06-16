DROP POLICY IF EXISTS "Platform admins manage companies" ON public.companies;

CREATE POLICY "Platform admins manage companies"
ON public.companies
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));