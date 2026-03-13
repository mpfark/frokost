
-- Add catering_order_id to guests table to track guests added via catering orders
ALTER TABLE public.guests ADD COLUMN catering_order_id uuid REFERENCES public.catering_orders(id) ON DELETE SET NULL;

-- Create function to auto-remove guests when a catering order is cancelled
CREATE OR REPLACE FUNCTION public.remove_guests_on_catering_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
    DELETE FROM public.guests WHERE catering_order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_remove_guests_on_catering_cancel
  AFTER UPDATE ON public.catering_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.remove_guests_on_catering_cancel();
