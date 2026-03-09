
-- Create kitchen_notifications table
CREATE TABLE public.kitchen_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.catering_orders(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'new_order', 'order_cancelled', 'confirmed_order_cancelled'
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.kitchen_notifications ENABLE ROW LEVEL SECURITY;

-- Kitchen and admin can view notifications
CREATE POLICY "Kitchen can view notifications" ON public.kitchen_notifications
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'kitchen'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Kitchen and admin can update (mark as read)
CREATE POLICY "Kitchen can update notifications" ON public.kitchen_notifications
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'kitchen'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Kitchen and admin can delete notifications
CREATE POLICY "Kitchen can delete notifications" ON public.kitchen_notifications
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'kitchen'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- System can insert (via trigger)
CREATE POLICY "System can insert notifications" ON public.kitchen_notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_notifications;

-- Trigger function for new orders
CREATE OR REPLACE FUNCTION public.notify_kitchen_on_catering_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_name text;
  v_message text;
  v_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(full_name, email) INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;
    v_message := v_user_name || ' har bestilt forplejning til "' || NEW.meeting_subject || '" d. ' || to_char(NEW.meeting_date, 'DD/MM') || ' (' || NEW.person_count || ' pers.)';
    INSERT INTO public.kitchen_notifications (order_id, type, message, metadata)
    VALUES (NEW.id, 'new_order', v_message, jsonb_build_object('meeting_subject', NEW.meeting_subject, 'meeting_date', NEW.meeting_date, 'person_count', NEW.person_count, 'user_name', v_user_name));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(full_name, email) INTO v_user_name FROM public.profiles WHERE id = OLD.user_id;
    IF OLD.status = 'confirmed' THEN
      v_type := 'confirmed_order_cancelled';
      v_message := '⚠️ Bekræftet forplejning annulleret: "' || OLD.meeting_subject || '" d. ' || to_char(OLD.meeting_date, 'DD/MM') || ' (bestilt af ' || v_user_name || ')';
    ELSE
      v_type := 'order_cancelled';
      v_message := 'Forplejning annulleret: "' || OLD.meeting_subject || '" d. ' || to_char(OLD.meeting_date, 'DD/MM') || ' (bestilt af ' || v_user_name || ')';
    END IF;
    INSERT INTO public.kitchen_notifications (order_id, type, message, metadata)
    VALUES (OLD.id, v_type, v_message, jsonb_build_object('meeting_subject', OLD.meeting_subject, 'meeting_date', OLD.meeting_date, 'person_count', OLD.person_count, 'user_name', v_user_name, 'was_confirmed', OLD.status = 'confirmed'));
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Notify when a confirmed order is cancelled via status change
    IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
      SELECT COALESCE(full_name, email) INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;
      v_message := '⚠️ Bekræftet forplejning annulleret: "' || NEW.meeting_subject || '" d. ' || to_char(NEW.meeting_date, 'DD/MM') || ' (bestilt af ' || v_user_name || ')';
      INSERT INTO public.kitchen_notifications (order_id, type, message, metadata)
      VALUES (NEW.id, 'confirmed_order_cancelled', v_message, jsonb_build_object('meeting_subject', NEW.meeting_subject, 'meeting_date', NEW.meeting_date, 'person_count', NEW.person_count, 'user_name', v_user_name));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger
CREATE TRIGGER on_catering_order_change
  AFTER INSERT OR DELETE OR UPDATE ON public.catering_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_kitchen_on_catering_change();
