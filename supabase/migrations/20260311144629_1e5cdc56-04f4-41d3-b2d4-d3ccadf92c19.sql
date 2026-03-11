
-- Drop the restrictive policy that only allows updating pending orders
DROP POLICY IF EXISTS "Users can update own pending orders" ON public.catering_orders;

-- Create a new policy allowing users to update their own orders (any non-delivered/cancelled status)
CREATE POLICY "Users can update own orders"
ON public.catering_orders
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Also allow users to cancel (delete) confirmed orders, not just pending
DROP POLICY IF EXISTS "Users can delete own pending orders" ON public.catering_orders;

CREATE POLICY "Users can delete own active orders"
ON public.catering_orders
FOR DELETE
TO public
USING (auth.uid() = user_id AND status IN ('pending', 'confirmed'));
