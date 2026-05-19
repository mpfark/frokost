
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  custom_domain text UNIQUE,
  allowed_domain text NOT NULL,
  primary_color text DEFAULT '25 95% 37%',
  secondary_color text DEFAULT '35 40% 90%',
  accent_color text DEFAULT '20 90% 48%',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_custom_domain ON public.companies(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_companies_active ON public.companies(is_active) WHERE is_active = true;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.companies (id, slug, name, custom_domain, allowed_domain, primary_color, secondary_color, accent_color)
SELECT id, 'pluskontoret', 'Pluskontoret', 'frokost.pluskontoret.dk', allowed_domain, primary_color, secondary_color, accent_color
FROM public.company_settings
LIMIT 1;

CREATE TABLE public.company_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, module_key)
);

ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_company_modules_updated_at
  BEFORE UPDATE ON public.company_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.company_modules (company_id, module_key, is_enabled)
SELECT c.id, m.module_key, true
FROM public.companies c
CROSS JOIN (VALUES ('lunch'), ('catering'), ('kitchen'), ('webflow'), ('microsoft')) AS m(module_key);

ALTER TABLE public.profiles ADD COLUMN company_id uuid REFERENCES public.companies(id);

UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies WHERE slug = 'pluskontoret' LIMIT 1);

CREATE POLICY "Authenticated can read companies"
  ON public.companies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform admins manage companies"
  ON public.companies FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Authenticated can read modules"
  ON public.company_modules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform admins manage all modules"
  ON public.company_modules FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Admins manage own company modules"
  ON public.company_modules FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );
