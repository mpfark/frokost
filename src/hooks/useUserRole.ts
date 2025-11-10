import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isKitchen, setIsKitchen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    const checkRoles = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!error && data) {
        const roles = data.map(r => r.role);
        setIsAdmin(roles.includes("admin"));
        setIsKitchen(roles.includes("kitchen"));
      } else {
        setIsAdmin(false);
        setIsKitchen(false);
      }
      setIsLoading(false);
    };

    checkRoles();

    // Subscribe to role changes
    const channel = supabase
      .channel("user_role_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          checkRoles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { isAdmin, isKitchen, isLoading };
};
