
-- 1. Drop trigger + helper functions tied to platform_admin
DROP TRIGGER IF EXISTS on_platform_admin_role_added ON public.user_roles;
DROP FUNCTION IF EXISTS public.remove_profile_on_platform_admin();
DROP FUNCTION IF EXISTS public.is_platform_admin(uuid);

-- 2. Drop platform-admin-specific policies
DROP POLICY IF EXISTS "Platform admins manage companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated can read companies" ON public.companies;
DROP POLICY IF EXISTS "Public can resolve active company domains" ON public.companies;
DROP POLICY IF EXISTS "Platform admins manage all modules" ON public.company_modules;

-- 3. Remove role data (must come before downgrading has_role so no admin
--    accidentally relies on inherited platform_admin escalation)
DELETE FROM public.user_roles WHERE role = 'platform_admin'::public.app_role;

-- 4. Replace has_role with exact-match-only version (signature unchanged → CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 5. Companies RLS — single-tenant friendly
CREATE POLICY "Authenticated can read companies"
ON public.companies
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage companies"
ON public.companies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. Drop per-tenant email sender columns
ALTER TABLE public.companies
  DROP COLUMN IF EXISTS sender_from_name,
  DROP COLUMN IF EXISTS sender_subdomain;

-- NOTE: The 'platform_admin' value remains in the app_role enum as a vestige.
-- Removing an enum value requires recreating the type which would cascade-drop
-- ~40 dependent RLS policies. Leaving the value is harmless once no rows use it.
