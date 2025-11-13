import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isKitchen, setIsKitchen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const previousRolesRef = useRef<{ admin: boolean; kitchen: boolean } | null>(null);

  useEffect(() => {
    if (!userId) {
      console.log("[useUserRole] No userId provided, resetting roles");
      setIsAdmin(false);
      setIsKitchen(false);
      setIsLoading(false);
      return;
    }

    const checkRoles = async () => {
      console.log("[useUserRole] Checking roles for user:", userId);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("[useUserRole] Error fetching roles:", error);
        // Keep previous roles on error - don't reset
        if (previousRolesRef.current) {
          console.log("[useUserRole] Using previous roles due to error:", previousRolesRef.current);
          setIsAdmin(previousRolesRef.current.admin);
          setIsKitchen(previousRolesRef.current.kitchen);
        } else {
          // No previous roles, set to false
          setIsAdmin(false);
          setIsKitchen(false);
        }
        setIsLoading(false);
        return;
      }

      // Always update roles, even if data is empty array
      const roles = data?.map(r => r.role) || [];
      const newIsAdmin = roles.includes("admin");
      const newIsKitchen = roles.includes("kitchen");
      
      console.log("[useUserRole] Roles fetched successfully:", { 
        admin: newIsAdmin, 
        kitchen: newIsKitchen,
        rawData: data 
      });
      
      // Check if roles changed
      const rolesChanged = previousRolesRef.current && 
        (previousRolesRef.current.admin !== newIsAdmin || previousRolesRef.current.kitchen !== newIsKitchen);
      
      if (rolesChanged) {
        console.log("[useUserRole] Roles changed from", previousRolesRef.current, "to", { admin: newIsAdmin, kitchen: newIsKitchen });
        toast.info("Dine rettigheder er blevet opdateret");
      }
      
      setIsAdmin(newIsAdmin);
      setIsKitchen(newIsKitchen);
      previousRolesRef.current = { admin: newIsAdmin, kitchen: newIsKitchen };
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
        (payload) => {
          console.log("[useUserRole] Realtime update received:", payload);
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
