import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const COLORS_CACHE_KEY = "company_colors_cache";

interface CachedColors {
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
}

const applyColors = (data: CachedColors) => {
  const root = document.documentElement;
  if (data.primary_color) {
    root.style.setProperty('--primary', data.primary_color);
  }
  if (data.secondary_color) {
    root.style.setProperty('--secondary', data.secondary_color);
  }
  if (data.accent_color) {
    root.style.setProperty('--accent', data.accent_color);
  }
};

export const useCompanyColors = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Apply cached colors immediately to prevent flash
    const cached = localStorage.getItem(COLORS_CACHE_KEY);
    if (cached) {
      try {
        const cachedColors = JSON.parse(cached) as CachedColors;
        applyColors(cachedColors);
      } catch (e) {
        console.error("Error parsing cached colors:", e);
      }
    }

    const hostname = window.location.hostname.toLowerCase();

    const loadColors = async () => {
      try {
        // Try the new companies table first, resolved by hostname
        const { data: byHost } = await supabase
          .from("companies")
          .select("primary_color, secondary_color, accent_color")
          .eq("custom_domain", hostname)
          .eq("is_active", true)
          .maybeSingle();

        let data: CachedColors | null = byHost ?? null;

        // Fallback: single active company (transition period)
        if (!data) {
          const { data: anyActive } = await supabase
            .from("companies")
            .select("primary_color, secondary_color, accent_color")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          data = anyActive ?? null;
        }

        if (data) {
          applyColors(data);
          localStorage.setItem(COLORS_CACHE_KEY, JSON.stringify(data));
        }
      } catch (error) {
        console.error("Error loading colors:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadColors();

    // Subscribe to color changes on companies table
    const channel = supabase
      .channel('companies_color_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'companies' },
        (payload) => {
          const data = payload.new as CachedColors;
          applyColors(data);
          localStorage.setItem(COLORS_CACHE_KEY, JSON.stringify({
            primary_color: data.primary_color,
            secondary_color: data.secondary_color,
            accent_color: data.accent_color,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { isLoading };
};
