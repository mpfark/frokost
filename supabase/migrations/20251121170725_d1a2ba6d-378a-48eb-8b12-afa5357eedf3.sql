-- Drop the trigger on profiles table first
DROP TRIGGER IF EXISTS trigger_auto_accept_invitation ON public.profiles;

-- Drop the trigger on auth.users if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_accept_invite ON auth.users;

-- Now drop the function
DROP FUNCTION IF EXISTS public.auto_accept_invitation() CASCADE;