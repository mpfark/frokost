-- Add guest_count column to lunch_signups table
ALTER TABLE public.lunch_signups 
ADD COLUMN guest_count integer NOT NULL DEFAULT 0;

-- Add check constraint to ensure guest_count is not negative
ALTER TABLE public.lunch_signups 
ADD CONSTRAINT guest_count_check CHECK (guest_count >= 0 AND guest_count <= 10);