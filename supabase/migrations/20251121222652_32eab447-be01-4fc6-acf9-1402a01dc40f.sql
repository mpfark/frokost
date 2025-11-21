-- Make the invitation acceptance policy PERMISSIVE to avoid conflicts with admin policies
DROP POLICY IF EXISTS "Users can mark their own invitation as accepted" ON public.invitations;

CREATE POLICY "Users can mark their own invitation as accepted"
ON public.invitations
AS PERMISSIVE
FOR UPDATE
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status = 'pending'
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status = 'accepted'
  AND used_by = auth.uid()
);