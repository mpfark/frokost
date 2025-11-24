-- Add reminder settings to company_settings table
ALTER TABLE public.company_settings
ADD COLUMN reminder_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN reminder_day INTEGER NOT NULL DEFAULT 1, -- 0=Sunday, 1=Monday, etc.
ADD COLUMN reminder_hour INTEGER NOT NULL DEFAULT 8; -- Hour in 24h format (0-23)

-- Add constraint to ensure reminder_day is between 0 and 6
ALTER TABLE public.company_settings
ADD CONSTRAINT reminder_day_check CHECK (reminder_day >= 0 AND reminder_day <= 6);

-- Add constraint to ensure reminder_hour is between 0 and 23
ALTER TABLE public.company_settings
ADD CONSTRAINT reminder_hour_check CHECK (reminder_hour >= 0 AND reminder_hour <= 23);