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
      setIsAdmin(false);
      setIsKitchen(false);
      setIsLoading(false);
      return;
    }

    const checkRoles = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("[useUserRole] Error fetching roles:", error);
        if (previousRolesRef.current) {
          setIsAdmin(previousRolesRef.current.admin);
          setIsKitchen(previousRolesRef.current.kitchen);
        } else {
          setIsAdmin(false);
          setIsKitchen(false);
        }
        setIsLoading(false);
        return;
      }

      const roles = data?.map((r) => r.role) || [];
      const newIsAdmin = roles.includes("admin");
      const newIsKitchen = roles.includes("kitchen");

      const rolesChanged =
        previousRolesRef.current &&
        (previousRolesRef.current.admin !== newIsAdmin ||
          previousRolesRef.current.kitchen !== newIsKitchen);

      if (rolesChanged) {
        toast.info("Dine rettigheder er blevet opdateret");
      }

      setIsAdmin(newIsAdmin);
      setIsKitchen(newIsKitchen);
      previousRolesRef.current = { admin: newIsAdmin, kitchen: newIsKitchen };
      setIsLoading(false);
    };

    checkRoles();

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
