ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS sender_subdomain text,
  ADD COLUMN IF NOT EXISTS sender_from_name text;

UPDATE public.companies
SET sender_subdomain = COALESCE(sender_subdomain, 'notify.frokost.pluskontoret.dk'),
    sender_from_name = COALESCE(sender_from_name, 'Plusfrokost')
WHERE slug = 'pluskontoret';