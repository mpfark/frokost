-- Add weeks_to_display setting to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN weeks_to_display integer NOT NULL DEFAULT 3;

-- Add a check constraint to ensure reasonable values (1-8 weeks)
ALTER TABLE public.company_settings 
ADD CONSTRAINT weeks_to_display_range CHECK (weeks_to_display >= 1 AND weeks_to_display <= 8);