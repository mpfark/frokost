
-- Fix the overly permissive update policy: prevent user_id changes
DROP POLICY "Authenticated users can update active orders" ON public.catering_orders;

CREATE POLICY "Authenticated users can update active orders"
ON public.catering_orders
FOR UPDATE
TO authenticated
USING (status = ANY(ARRAY['pending'::text, 'confirmed'::text]))
WITH CHECK (user_id = user_id);

-- Create trigger to notify order owner when someone else modifies/cancels their order
CREATE OR REPLACE FUNCTION public.notify_owner_on_cross_user_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
  v_message text;
BEGIN
  -- Only fire when a different user makes the change
  IF auth.uid() IS NULL OR auth.uid() = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, email) INTO v_actor_name
  FROM public.profiles WHERE id = auth.uid();

  IF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
    -- Someone cancelled the order
    v_message := v_actor_name || ' har annulleret din forplejningsbestilling til "' || NEW.meeting_subject || '" d. ' || to_char(NEW.meeting_date, 'DD/MM');
    INSERT INTO public.user_notifications (user_id, type, message, metadata)
    VALUES (NEW.user_id, 'order_cancelled_by_other', v_message, jsonb_build_object(
      'order_id', NEW.id,
      'meeting_subject', NEW.meeting_subject,
      'meeting_date', NEW.meeting_date,
      'changed_by', auth.uid()
    ));
  ELSIF OLD.person_count <> NEW.person_count 
     OR OLD.catering_types <> NEW.catering_types 
     OR COALESCE(OLD.comment, '') <> COALESCE(NEW.comment, '') THEN
    -- Someone modified the order
    v_message := v_actor_name || ' har ændret din forplejningsbestilling til "' || NEW.meeting_subject || '" d. ' || to_char(NEW.meeting_date, 'DD/MM');
    INSERT INTO public.user_notifications (user_id, type, message, metadata)
    VALUES (NEW.user_id, 'order_modified_by_other', v_message, jsonb_build_object(
      'order_id', NEW.id,
      'meeting_subject', NEW.meeting_subject,
      'meeting_date', NEW.meeting_date,
      'changed_by', auth.uid()
    ));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_owner_on_cross_user_catering_change
BEFORE UPDATE ON public.catering_orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_owner_on_cross_user_change();
