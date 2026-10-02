import { useEffect, useState } from "react";
import { AppSession } from "./AppSession";
import type { User } from "@supabase/supabase-js";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { KitchenNotifications } from "@/components/kitchen/KitchenNotifications";
import { UserNotifications } from "@/components/notifications/UserNotifications";
import { AppHeader } from "./AppHeader";
import { toast } from "sonner";

export function AppLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<{id:string;name:string} | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const { isAdmin, isKitchen, isLoading: isRoleLoading } = useUserRole(user?.id);
  const canAccessKitchen = isAdmin || isKitchen;
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedTab = params.get("tab") || "calendar";
  const activeTab = ["calendar", "outlook", "kitchen", "admin", "profile"].includes(requestedTab) ? requestedTab : "calendar";

  useEffect(() => {
    let cancelled = false;
    let authEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        authEventReceived = true;
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Når brugeren netop er logget ind via Microsoft,
        // markér eventuel pending invitation som accepted. Idempotent — gør
        // intet hvis ingen pending invitation findes for emailen.
        if (event === "SIGNED_IN" && session?.user) {
          supabase.functions.invoke("accept-invitation").catch((err) => {
            console.warn("accept-invitation call failed (ignored):", err);
          });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && !authEventReceived) {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!cancelled && !authEventReceived) {
        setIsLoading(false);
        toast.error("Kunne ikke indlæse login. Prøv at genindlæse siden.");
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);


  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.resolve(supabase.from("profiles").select("full_name").eq("id", user.id).single()).then(({data}) => {
      if (!cancelled) setProfile({id:user.id,name:data?.full_name || ""});
    }).catch(() => {
      if (!cancelled) setProfile(null);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user || isLoading || isRoleLoading || location.pathname !== "/") return;
    if ((activeTab === "kitchen" && !canAccessKitchen) || (activeTab === "admin" && !isAdmin)) {
      navigate("/", {replace:true});
      toast.info("Du har ikke adgang til denne visning");
    }
  }, [user, isLoading, isRoleLoading, activeTab, canAccessKitchen, isAdmin, location.pathname, navigate]);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const {error} = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/", {replace:true});
      toast.success("Logget ud");
    } catch { toast.error("Kunne ikke logge ud. Prøv igen."); }
    finally { setLoggingOut(false); }
  };
  const loading = isLoading || isRoleLoading;
  const name = profile?.id === user?.id && profile?.name ? profile.name : user?.user_metadata?.full_name || user?.email || "Medarbejder";
  return <AppSession.Provider value={{user,isLoading:loading,isAdmin,canAccessKitchen,activeTab}}>
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader activeTab={location.pathname === "/" && user ? activeTab : null} fullName={name} role={isAdmin ? "Administrator" : isKitchen ? "Køkken" : "Medarbejder"} signedIn={!!user} loading={loading} isAdmin={isAdmin} canAccessKitchen={canAccessKitchen} onLogout={logout} loggingOut={loggingOut} notifications={canAccessKitchen ? <KitchenNotifications /> : <UserNotifications />} />
      <Outlet />
    </div>
  </AppSession.Provider>;
}
