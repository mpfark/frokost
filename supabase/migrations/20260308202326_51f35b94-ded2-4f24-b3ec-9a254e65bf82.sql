
CREATE TABLE public.catering_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meeting_subject TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TEXT NOT NULL,
  meeting_location TEXT,
  person_count INTEGER NOT NULL DEFAULT 1,
  catering_types TEXT[] NOT NULL DEFAULT '{}',
  dietary_notes TEXT,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.catering_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own catering orders"
  ON public.catering_orders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create orders
CREATE POLICY "Users can create catering orders"
  ON public.catering_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own pending orders
CREATE POLICY "Users can update own pending orders"
  ON public.catering_orders FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- Users can delete own pending orders
CREATE POLICY "Users can delete own pending orders"
  ON public.catering_orders FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

-- Kitchen staff can view all orders
CREATE POLICY "Kitchen can view all catering orders"
  ON public.catering_orders FOR SELECT
  USING (public.has_role(auth.uid(), 'kitchen'));

-- Kitchen staff can update orders (change status)
CREATE POLICY "Kitchen can update catering orders"
  ON public.catering_orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'kitchen'));

-- Admins can view all orders
CREATE POLICY "Admins can view all catering orders"
  ON public.catering_orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all orders
CREATE POLICY "Admins can update all catering orders"
  ON public.catering_orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete all orders
CREATE POLICY "Admins can delete all catering orders"
  ON public.catering_orders FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_catering_orders_updated_at
  BEFORE UPDATE ON public.catering_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
