import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isKitchen, setIsKitchen] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const previousRolesRef = useRef<{ admin: boolean; kitchen: boolean; platformAdmin: boolean } | null>(null);

  useEffect(() => {
    if (!userId) {
      console.log("[useUserRole] No userId provided, resetting roles");
      setIsAdmin(false);
      setIsKitchen(false);
      setIsPlatformAdmin(false);
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
          setIsPlatformAdmin(previousRolesRef.current.platformAdmin);
        } else {
          setIsAdmin(false);
          setIsKitchen(false);
          setIsPlatformAdmin(false);
        }
        setIsLoading(false);
        return;
      }

      const roles = data?.map(r => r.role) || [];
      const newIsAdmin = roles.includes("admin");
      const newIsKitchen = roles.includes("kitchen");
      const newIsPlatformAdmin = roles.includes("platform_admin");

      console.log("[useUserRole] Roles fetched successfully:", {
        admin: newIsAdmin,
        kitchen: newIsKitchen,
        platformAdmin: newIsPlatformAdmin,
        rawData: data
      });

      const rolesChanged = previousRolesRef.current &&
        (previousRolesRef.current.admin !== newIsAdmin ||
         previousRolesRef.current.kitchen !== newIsKitchen ||
         previousRolesRef.current.platformAdmin !== newIsPlatformAdmin);

      if (rolesChanged) {
        console.log("[useUserRole] Roles changed");
        toast.info("Dine rettigheder er blevet opdateret");
      }

      setIsAdmin(newIsAdmin);
      setIsKitchen(newIsKitchen);
      setIsPlatformAdmin(newIsPlatformAdmin);
      previousRolesRef.current = { admin: newIsAdmin, kitchen: newIsKitchen, platformAdmin: newIsPlatformAdmin };
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

  return { isAdmin, isKitchen, isPlatformAdmin, isLoading };
};
