
-- Allow all authenticated users to view all catering orders (for shared order discovery)
CREATE POLICY "Authenticated users can view all catering orders"
ON public.catering_orders
FOR SELECT
TO authenticated
USING (true);

-- Allow any authenticated user to update active orders (shared editing)
CREATE POLICY "Authenticated users can update active orders"
ON public.catering_orders
FOR UPDATE
TO authenticated
USING (status IN ('pending', 'confirmed'))
WITH CHECK (true);

-- Drop the old user-scoped SELECT policy (now redundant)
DROP POLICY IF EXISTS "Users can view own catering orders" ON public.catering_orders;

-- Drop the old user-scoped UPDATE policy (now covered by shared + admin/kitchen)
DROP POLICY IF EXISTS "Users can update own orders" ON public.catering_orders;
