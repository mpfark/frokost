
ALTER TABLE public.catering_orders
  ADD COLUMN confirmed_by uuid,
  ADD COLUMN confirmed_at timestamptz;
