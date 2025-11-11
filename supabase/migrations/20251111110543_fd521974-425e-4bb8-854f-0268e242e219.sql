-- Function to auto-accept invitations when profile is created
CREATE OR REPLACE FUNCTION public.auto_accept_invitation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.invitations
  SET 
    status = 'accepted',
    accepted_at = NEW.created_at,
    used_by = NEW.id
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger that fires after profile insert
CREATE TRIGGER trigger_auto_accept_invitation
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_accept_invitation();