
CREATE OR REPLACE FUNCTION public.notify_kitchen_on_catering_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Notify when any order is cancelled via status change
    IF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
      SELECT COALESCE(full_name, email) INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;
      IF OLD.status = 'confirmed' THEN
        v_type := 'confirmed_order_cancelled';
        v_message := '⚠️ Bekræftet forplejning annulleret: "' || NEW.meeting_subject || '" d. ' || to_char(NEW.meeting_date, 'DD/MM') || ' (bestilt af ' || v_user_name || ')';
      ELSE
        v_type := 'order_cancelled';
        v_message := 'Forplejning annulleret: "' || NEW.meeting_subject || '" d. ' || to_char(NEW.meeting_date, 'DD/MM') || ' (bestilt af ' || v_user_name || ')';
      END IF;
      INSERT INTO public.kitchen_notifications (order_id, type, message, metadata)
      VALUES (NEW.id, v_type, v_message, jsonb_build_object('meeting_subject', NEW.meeting_subject, 'meeting_date', NEW.meeting_date, 'person_count', NEW.person_count, 'user_name', v_user_name, 'was_confirmed', OLD.status = 'confirmed'));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;
