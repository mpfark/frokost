import { supabase } from "@/integrations/supabase/client";

export type TenantMode = "tenant";

export interface ResolvedCompany {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  allowed_domain: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  is_active: boolean;
}

export interface TenantResolution {
  mode: TenantMode;
  company: ResolvedCompany | null;
  hostname: string;
}

const COMPANY_RESOLUTION_FIELDS =
  "id,slug,name,custom_domain,allowed_domain,primary_color,secondary_color,accent_color,is_active";

/**
 * Single-tenant resolver. Looks up companies.custom_domain = hostname first;
 * falls back to the single active company (covers preview / lovable.app URLs).
 */
export async function resolveTenant(): Promise<TenantResolution> {
  const hostname = window.location.hostname.toLowerCase();

  const { data: matched } = await supabase
    .from("companies")
    .select(COMPANY_RESOLUTION_FIELDS)
    .eq("custom_domain", hostname)
    .eq("is_active", true)
    .maybeSingle();

  if (matched) {
    return { mode: "tenant", company: matched as ResolvedCompany, hostname };
  }

  const { data: active } = await supabase
    .from("companies")
    .select(COMPANY_RESOLUTION_FIELDS)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  return {
    mode: "tenant",
    company: (active?.[0] as ResolvedCompany) ?? null,
    hostname,
  };
}
