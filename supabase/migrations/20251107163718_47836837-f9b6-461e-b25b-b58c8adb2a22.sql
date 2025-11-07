-- Fix 1: Restrict guests table to authenticated users only
DROP POLICY IF EXISTS "Anyone can view guests" ON guests;

CREATE POLICY "Authenticated users can view guests"
ON guests FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Add UPDATE policy to lunch_signups so users can modify their own signups
CREATE POLICY "Users can update own signups"
ON lunch_signups FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);