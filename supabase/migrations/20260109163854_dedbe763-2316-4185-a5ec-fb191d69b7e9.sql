-- Create optouts table for tracking users who explicitly opt out of lunch
CREATE TABLE public.lunch_optouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lunch_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, lunch_date)
);

-- Enable RLS
ALTER TABLE public.lunch_optouts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all optouts (needed for UI display)
CREATE POLICY "Authenticated users can view optouts"
ON public.lunch_optouts FOR SELECT
USING (true);

-- Users can insert their own optouts
CREATE POLICY "Users can insert own optouts"
ON public.lunch_optouts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own optouts
CREATE POLICY "Users can delete own optouts"
ON public.lunch_optouts FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for optouts
ALTER PUBLICATION supabase_realtime ADD TABLE public.lunch_optouts;