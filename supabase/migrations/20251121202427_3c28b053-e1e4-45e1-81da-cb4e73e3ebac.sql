-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can mark their own invitation as accepted" ON public.invitations;

-- Create a new policy that allows users to update their own invitation status
CREATE POLICY "Users can mark their own invitation as accepted"
ON public.invitations
FOR UPDATE
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  AND status = 'pending'
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  AND status = 'accepted'
  AND used_by = auth.uid()
);