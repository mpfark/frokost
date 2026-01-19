-- Create audit log table
CREATE TABLE public.signup_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  lunch_date DATE NOT NULL,
  details JSONB
);

-- Enable RLS
ALTER TABLE public.signup_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.signup_audit_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_signup_audit_log_created_at ON public.signup_audit_log(created_at DESC);
CREATE INDEX idx_signup_audit_log_user_id ON public.signup_audit_log(user_id);
CREATE INDEX idx_signup_audit_log_lunch_date ON public.signup_audit_log(lunch_date);

-- Function to log signup changes
CREATE OR REPLACE FUNCTION public.log_signup_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
    VALUES (NEW.user_id, 'signup_created', NEW.lunch_date, jsonb_build_object('signup_id', NEW.id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
    VALUES (OLD.user_id, 'signup_deleted', OLD.lunch_date, jsonb_build_object('signup_id', OLD.id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to log optout changes
CREATE OR REPLACE FUNCTION public.log_optout_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
    VALUES (NEW.user_id, 'optout_created', NEW.lunch_date, jsonb_build_object('optout_id', NEW.id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
    VALUES (OLD.user_id, 'optout_deleted', OLD.lunch_date, jsonb_build_object('optout_id', OLD.id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to log guest changes
CREATE OR REPLACE FUNCTION public.log_guest_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_lunch_date DATE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id, lunch_date INTO v_user_id, v_lunch_date
    FROM public.lunch_signups WHERE id = NEW.signup_id;
    
    INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
    VALUES (v_user_id, 'guest_added', v_lunch_date, jsonb_build_object(
      'guest_id', NEW.id,
      'signup_id', NEW.signup_id,
      'is_gluten_free', NEW.is_gluten_free,
      'is_lactose_free', NEW.is_lactose_free,
      'is_vegetarian', NEW.is_vegetarian
    ));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT user_id, lunch_date INTO v_user_id, v_lunch_date
    FROM public.lunch_signups WHERE id = OLD.signup_id;
    
    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
      VALUES (v_user_id, 'guest_removed', v_lunch_date, jsonb_build_object(
        'guest_id', OLD.id,
        'signup_id', OLD.signup_id
      ));
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_log_signup_change
  AFTER INSERT OR DELETE ON public.lunch_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.log_signup_change();

CREATE TRIGGER trigger_log_optout_change
  AFTER INSERT OR DELETE ON public.lunch_optouts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_optout_change();

CREATE TRIGGER trigger_log_guest_change
  AFTER INSERT OR DELETE ON public.guests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_guest_change();