import { supabase } from "@/integrations/supabase/client";

export type TenantMode = "platform" | "tenant";

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

// Hosts that always render the platform admin UI (no tenant resolution).
const PLATFORM_HOSTS = new Set<string>(
  [
    (import.meta.env.VITE_PLATFORM_HOST as string | undefined)?.toLowerCase(),
    "frokost.gakgak.net",
  ].filter((h): h is string => Boolean(h))
);

/**
 * Hostname → tenant resolution.
 *
 * 1. If hostname is a known platform host → platform mode.
 * 2. Lookup companies.custom_domain = hostname → tenant mode.
 * 3. Fallback: if exactly one active company exists, use it (covers lovable.app preview URLs
 *    during the transition period). Once a second company is added, this fallback returns
 *    platform mode automatically.
 */
export async function resolveTenant(): Promise<TenantResolution> {
  const hostname = window.location.hostname.toLowerCase();

  if (PLATFORM_HOSTS.has(hostname)) {
    return { mode: "platform", company: null, hostname };
  }


  const { data: matched } = await supabase
    .from("companies")
    .select("*")
    .eq("custom_domain", hostname)
    .eq("is_active", true)
    .maybeSingle();

  if (matched) {
    return { mode: "tenant", company: matched as ResolvedCompany, hostname };
  }

  // Fallback for preview / lovable.app while only one tenant exists
  const { data: active } = await supabase
    .from("companies")
    .select("*")
    .eq("is_active", true)
    .limit(2);

  if (active && active.length === 1) {
    return { mode: "tenant", company: active[0] as ResolvedCompany, hostname };
  }

  return { mode: "platform", company: null, hostname };
}
