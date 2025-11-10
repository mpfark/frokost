-- Allow users to update invitations that match their email when they sign up
CREATE POLICY "Users can mark their own invitation as accepted"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status = 'accepted'
);