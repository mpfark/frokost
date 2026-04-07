
DROP POLICY "Authenticated users can update active orders" ON public.catering_orders;

CREATE POLICY "Authenticated users can update active orders"
ON public.catering_orders
FOR UPDATE
TO authenticated
USING (status = ANY(ARRAY['pending'::text, 'confirmed'::text]))
WITH CHECK (user_id = (SELECT co.user_id FROM public.catering_orders co WHERE co.id = catering_orders.id));
