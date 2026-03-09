
-- Tighten insert policy: only allow inserts from service role (trigger uses SECURITY DEFINER)
DROP POLICY "System can insert notifications" ON public.kitchen_notifications;
CREATE POLICY "No direct inserts" ON public.kitchen_notifications
  FOR INSERT TO authenticated
  WITH CHECK (false);
