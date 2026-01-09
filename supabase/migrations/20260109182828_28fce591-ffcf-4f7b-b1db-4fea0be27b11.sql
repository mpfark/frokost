-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view optouts" ON public.lunch_optouts;

-- Create policy for users to view only their own opt-outs
CREATE POLICY "Users can view own optouts" 
ON public.lunch_optouts 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow kitchen staff to view all opt-outs (needed for operations)
CREATE POLICY "Kitchen staff can view all optouts" 
ON public.lunch_optouts 
FOR SELECT 
USING (has_role(auth.uid(), 'kitchen'::app_role));

-- Allow admins to view all opt-outs
CREATE POLICY "Admins can view all optouts" 
ON public.lunch_optouts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));