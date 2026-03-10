CREATE TRIGGER send_push_on_kitchen_notification
  AFTER INSERT ON public.kitchen_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_kitchen_notification();