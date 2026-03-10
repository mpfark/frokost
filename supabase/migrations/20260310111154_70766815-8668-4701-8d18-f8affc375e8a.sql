-- Create trigger for user_notifications to send push
CREATE TRIGGER send_push_on_user_notification
  AFTER INSERT ON public.user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_user_notification();

-- Create trigger for kitchen_notifications to send push
CREATE TRIGGER send_push_on_kitchen_notification
  AFTER INSERT ON public.kitchen_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_kitchen_notification();