REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_profile_on_platform_admin() FROM anon, authenticated, PUBLIC;
-- has_role stays callable by authenticated (used by RLS policies on tenant side)