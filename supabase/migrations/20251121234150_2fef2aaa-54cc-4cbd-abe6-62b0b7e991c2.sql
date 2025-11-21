-- Drop the restrictive admin policy
DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;

-- Recreate it as PERMISSIVE so it doesn't block user updates
CREATE POLICY "Admins can update invitations"
ON public.invitations
AS PERMISSIVE
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);