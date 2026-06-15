INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'platform_admin'::app_role
FROM public.user_roles
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;