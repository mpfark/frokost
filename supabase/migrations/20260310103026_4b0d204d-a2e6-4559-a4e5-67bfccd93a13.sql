CREATE TRIGGER send_push_on_user_notification
  AFTER INSERT ON public.user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_user_notification();