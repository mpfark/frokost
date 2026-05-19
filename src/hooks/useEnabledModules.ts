import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentCompany } from "@/contexts/TenantContext";
import { MODULE_REGISTRY, ModuleKey, ModuleDefinition } from "@/modules/registry";

/**
 * Returns the list of module definitions enabled for the current company.
 * If no company is resolved, returns all modules (safe default during transition).
 */
export const useEnabledModules = () => {
  const company = useCurrentCompany();
  const [enabledKeys, setEnabledKeys] = useState<Set<ModuleKey> | null>(null);

  useEffect(() => {
    if (!company) {
      setEnabledKeys(null);
      return;
    }

    let cancelled = false;
    supabase
      .from("company_modules")
      .select("module_key, is_enabled")
      .eq("company_id", company.id)
      .eq("is_enabled", true)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Error loading modules:", error);
          setEnabledKeys(new Set(MODULE_REGISTRY.map((m) => m.key)));
          return;
        }
        setEnabledKeys(new Set((data ?? []).map((r) => r.module_key as ModuleKey)));
      });

    return () => {
      cancelled = true;
    };
  }, [company?.id]);

  const modules: ModuleDefinition[] = enabledKeys
    ? MODULE_REGISTRY.filter((m) => enabledKeys.has(m.key))
    : MODULE_REGISTRY;

  return {
    modules,
    isEnabled: (key: ModuleKey) =>
      enabledKeys ? enabledKeys.has(key) : true,
    isLoading: enabledKeys === null && !!company,
  };
};
