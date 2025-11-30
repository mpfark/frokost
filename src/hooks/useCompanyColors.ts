import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useCompanyColors = () => {
  useEffect(() => {
    const loadColors = async () => {
      try {
        const { data, error } = await supabase
          .from("company_settings")
          .select("primary_color, secondary_color, accent_color")
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error loading colors:", error);
          return;
        }

        if (data) {
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
        }
      } catch (error) {
        console.error("Error loading colors:", error);
      }
    };

    loadColors();

    // Subscribe to changes
    const channel = supabase
      .channel('company_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_settings'
        },
        (payload) => {
          const data = payload.new as any;
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
