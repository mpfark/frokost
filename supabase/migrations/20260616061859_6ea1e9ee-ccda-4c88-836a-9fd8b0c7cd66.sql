
-- Platform admin = super admin: satisfy any has_role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR role = 'platform_admin'::app_role)
  )
$$;

-- Helper to identify platform admins
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'platform_admin'::app_role
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, anon;

-- When a user gets the platform_admin role, remove their tenant profile
CREATE OR REPLACE FUNCTION public.remove_profile_on_platform_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'platform_admin'::app_role THEN
    DELETE FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_platform_admin_role_added ON public.user_roles;
CREATE TRIGGER on_platform_admin_role_added
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.remove_profile_on_platform_admin();

-- Exclude platform admins from active user count
CREATE OR REPLACE FUNCTION public.get_active_user_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.profiles p
  WHERE p.is_active = true
    AND p.reminder_enabled = true
    AND NOT public.is_platform_admin(p.id)
$$;

-- Clean up any existing platform-admin profiles in tenant
DELETE FROM public.profiles
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'platform_admin'::app_role);
