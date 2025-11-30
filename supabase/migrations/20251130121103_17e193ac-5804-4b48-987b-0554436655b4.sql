-- Add color customization columns to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '25 95% 37%',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '35 40% 90%',
ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '20 90% 48%';