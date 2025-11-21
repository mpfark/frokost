-- Drop the problematic policy that queries auth.users
DROP POLICY IF EXISTS "Users can mark their own invitation as accepted" ON public.invitations;

-- Create new policy using auth.jwt() to avoid permission issues
CREATE POLICY "Users can mark their own invitation as accepted"
ON public.invitations
AS PERMISSIVE
FOR UPDATE
USING (
  -- User can only update their own invitation (matched by email in JWT)
  email = lower((auth.jwt() ->> 'email')::text)
  AND status = 'pending'
)
WITH CHECK (
  -- After update, verify email matches, status is accepted, and used_by is set
  email = lower((auth.jwt() ->> 'email')::text)
  AND status = 'accepted'
  AND used_by = auth.uid()
);