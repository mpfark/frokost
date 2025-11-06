-- Create table for closed/locked dates
CREATE TABLE public.closed_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.closed_dates ENABLE ROW LEVEL SECURITY;

-- Everyone can view closed dates
CREATE POLICY "Anyone can view closed dates"
ON public.closed_dates
FOR SELECT
USING (true);

-- Only authenticated users can manage closed dates (will add role check later if needed)
CREATE POLICY "Authenticated users can insert closed dates"
ON public.closed_dates
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete closed dates"
ON public.closed_dates
FOR DELETE
TO authenticated
USING (true);