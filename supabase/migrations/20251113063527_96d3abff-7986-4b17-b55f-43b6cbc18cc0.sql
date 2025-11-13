-- Remove the overly permissive public access policy from invitations table
DROP POLICY IF EXISTS "Anyone can validate invite code" ON public.invitations;

-- The remaining policies ensure:
-- 1. Admins can view, create, update, delete all invitations
-- 2. Users can only mark their OWN invitation as accepted (email must match auth user)
-- 3. No public access - invite validation now goes through secure edge function

-- This prevents email harvesting and protects PII while maintaining functionality