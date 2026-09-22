-- Verified organizer-side immutable event references. Never expose mailbox IDs
-- to browser clients or let a caller choose another user's source calendar.
CREATE TABLE public.catering_calendar_sources (
  order_id uuid PRIMARY KEY REFERENCES public.catering_orders(id) ON DELETE CASCADE,
  mailbox text NOT NULL,
  event_id text NOT NULL,
  external_id text NOT NULL
);
ALTER TABLE public.catering_calendar_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catering_calendar_sources FROM anon, authenticated;
GRANT ALL ON public.catering_calendar_sources TO service_role;

-- Preserve manual notifications; suppress only the generic kitchen message
-- while the calendar RPC writes its specific message in the same transaction.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.catering_orders'::regclass AND NOT tgisinternal
      AND tgfoid = 'public.notify_kitchen_on_catering_change()'::regprocedure
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.catering_orders', t.tgname);
  END LOOP;
END;
$$;
CREATE TRIGGER notify_kitchen_on_catering_change
AFTER INSERT OR UPDATE OR DELETE ON public.catering_orders
FOR EACH ROW
WHEN (coalesce(current_setting('app.calendar_reconciliation', true), '') <> 'on')
EXECUTE FUNCTION public.notify_kitchen_on_catering_change();

CREATE FUNCTION public.apply_calendar_order_change(
  p_order_id uuid, p_expected_updated_at timestamptz, p_change jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.catering_orders%ROWTYPE;
  v_kind text := p_change->>'kind';
  v_message text;
  v_metadata jsonb;
  v_previous_setting text;
BEGIN
  IF v_kind IS NULL OR v_kind NOT IN ('moved', 'cancelled', 'location', 'subject') THEN
    RAISE EXCEPTION 'Invalid calendar change';
  END IF;
  SELECT * INTO v_order FROM public.catering_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status NOT IN ('pending', 'confirmed')
    OR v_order.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN false;
  END IF;

  IF v_kind = 'moved' THEN
    v_message := format('Mødet "%s" er flyttet fra %s kl. %s til %s kl. %s. Forplejningsbestillingen er annulleret — bestil igen til det nye tidspunkt.',
      v_order.meeting_subject, v_order.meeting_date, v_order.meeting_time, p_change->>'date', p_change->>'time');
  ELSIF v_kind = 'cancelled' THEN
    v_message := format('Mødet "%s" er annulleret eller slettet fra arrangørens kalender. Forplejningsbestillingen er automatisk annulleret.', v_order.meeting_subject);
  ELSIF v_kind = 'location' THEN
    v_message := format('Mødet "%s" er flyttet fra lokale "%s" til "%s". Forplejningsbestillingen er bevaret, og leveringsstedet er opdateret.',
      v_order.meeting_subject, coalesce(v_order.meeting_location, 'Ikke angivet'), coalesce(p_change->>'location', 'Ikke angivet'));
  END IF;
  v_metadata := jsonb_build_object('order_id', v_order.id, 'meeting_subject', v_order.meeting_subject,
    'meeting_date', v_order.meeting_date, 'old_time', v_order.meeting_time,
    'old_location', v_order.meeting_location, 'change', p_change, 'was_confirmed', v_order.status = 'confirmed');

  v_previous_setting := current_setting('app.calendar_reconciliation', true);
  PERFORM set_config('app.calendar_reconciliation', 'on', true);
  UPDATE public.catering_orders SET
    status = CASE WHEN v_kind IN ('moved', 'cancelled') THEN 'cancelled' ELSE status END,
    -- Preserve original date/time on cancelled orders for history and linked guests.
    meeting_location = CASE WHEN v_kind = 'location' THEN p_change->>'location' ELSE meeting_location END,
    meeting_subject = CASE WHEN v_kind IN ('location', 'subject') THEN coalesce(p_change->>'subject', meeting_subject) ELSE meeting_subject END,
    updated_at = clock_timestamp()
  WHERE id = p_order_id;
  PERFORM set_config('app.calendar_reconciliation', coalesce(v_previous_setting, ''), true);

  IF v_message IS NOT NULL THEN
    INSERT INTO public.user_notifications(user_id, type, message, metadata)
      VALUES(v_order.user_id, 'calendar_' || v_kind, v_message, v_metadata);
    INSERT INTO public.kitchen_notifications(order_id, type, message, metadata)
      VALUES(v_order.id, 'calendar_' || v_kind, v_message, v_metadata);
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_calendar_order_change(uuid, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_calendar_order_change(uuid, timestamptz, jsonb) TO service_role;
