-- Add marked_absent_at column to lunch_signups
ALTER TABLE public.lunch_signups 
ADD COLUMN marked_absent_at TIMESTAMPTZ DEFAULT NULL;

-- Update the existing log_signup_change function to handle absence marking
CREATE OR REPLACE FUNCTION public.log_signup_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
    VALUES (NEW.user_id, 'signup_created', NEW.lunch_date, jsonb_build_object('signup_id', NEW.id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
    VALUES (OLD.user_id, 'signup_deleted', OLD.lunch_date, jsonb_build_object('signup_id', OLD.id));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if absence status changed
    IF (OLD.marked_absent_at IS NULL AND NEW.marked_absent_at IS NOT NULL) THEN
      INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
      VALUES (NEW.user_id, 'marked_absent', NEW.lunch_date, jsonb_build_object('signup_id', NEW.id, 'marked_at', NEW.marked_absent_at));
    ELSIF (OLD.marked_absent_at IS NOT NULL AND NEW.marked_absent_at IS NULL) THEN
      INSERT INTO public.signup_audit_log (user_id, action, lunch_date, details)
      VALUES (NEW.user_id, 'unmarked_absent', NEW.lunch_date, jsonb_build_object('signup_id', NEW.id));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- Create trigger for UPDATE if it doesn't exist
DROP TRIGGER IF EXISTS log_signup_changes ON public.lunch_signups;
CREATE TRIGGER log_signup_changes
AFTER INSERT OR UPDATE OR DELETE ON public.lunch_signups
FOR EACH ROW
EXECUTE FUNCTION public.log_signup_change();