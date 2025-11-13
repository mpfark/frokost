import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { AuthForm } from "@/components/AuthForm";
import { LunchCalendar } from "@/components/LunchCalendar";
import { KitchenView } from "@/components/KitchenView";
import { ProfileSettings } from "@/components/ProfileSettings";
import { PasswordChange } from "@/components/PasswordChange";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, UtensilsCrossed, User as UserIcon, Calendar, ChefHat, Settings } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("calendar");
  const { isAdmin, isKitchen, isLoading: isRoleLoading } = useUserRole(user?.id);
  const canAccessKitchen = isAdmin || isKitchen;

  // Log access state for debugging
  useEffect(() => {
    console.log("[Index] Access state:", { 
      isAdmin, 
      isKitchen, 
      canAccessKitchen, 
      activeTab, 
      isRoleLoading 
    });
  }, [isAdmin, isKitchen, canAccessKitchen, activeTab, isRoleLoading]);

  // Defensive check: if user loses kitchen access while on kitchen tab, redirect to calendar
  // Only redirect if roles are definitely loaded and access is lost
  useEffect(() => {
    if (!isRoleLoading && activeTab === "kitchen" && !canAccessKitchen) {
      console.log("[Index] User lost kitchen access, switching to calendar");
      setActiveTab("calendar");
      toast.info("Du har ikke længere adgang til køkken-visningen");
    }
  }, [canAccessKitchen, activeTab, isRoleLoading]);

  // Defensive check: if user loses admin access while on admin tab, redirect to calendar
  useEffect(() => {
    if (!isRoleLoading && activeTab === "admin" && !isAdmin) {
      console.log("[Index] User lost admin access, switching to calendar");
      setActiveTab("calendar");
      toast.info("Du har ikke længere adgang til admin-panelet");
    }
  }, [isAdmin, activeTab, isRoleLoading]);

  useEffect(() => {

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Logget ud");
  };

  if (isLoading || isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-background overflow-y-scroll">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <button 
              onClick={() => setActiveTab("calendar")} 
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="text-left hidden sm:block">
                <h1 className="text-xl font-bold">Plusfrokost</h1>
                <p className="text-sm text-muted-foreground">De næste 3 ugers plan</p>
              </div>
            </button>

            {/* Navigation */}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant={activeTab === "calendar" ? "default" : "ghost"}
                size="icon"
                onClick={() => setActiveTab("calendar")}
                className="md:w-auto md:px-4"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden md:inline ml-2">Min plan</span>
              </Button>

              {canAccessKitchen && (
                <Button
                  variant={activeTab === "kitchen" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setActiveTab("kitchen")}
                  className="md:w-auto md:px-4"
                >
                  <ChefHat className="w-4 h-4" />
                  <span className="hidden md:inline ml-2">Køkken</span>
                </Button>
              )}

              {isAdmin && (
                <Button
                  variant={activeTab === "admin" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setActiveTab("admin")}
                  className="md:w-auto md:px-4"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden md:inline ml-2">Admin</span>
                </Button>
              )}
            </div>

            {/* Profile & Logout */}
            <div className="flex items-center gap-2">
              <Button 
                variant={activeTab === "profile" ? "default" : "ghost"}
                size="icon" 
                onClick={() => setActiveTab("profile")}
              >
                <UserIcon className="w-4 h-4" />
              </Button>
              <Button onClick={handleSignOut} variant="outline" size="icon">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {(isAdmin || canAccessKitchen) ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="calendar">
              <div className="max-w-7xl mx-auto">
                <LunchCalendar userId={user.id} />
              </div>
            </TabsContent>
            <TabsContent value="kitchen">
              <div className="max-w-7xl mx-auto">
                <KitchenView />
              </div>
            </TabsContent>
            <TabsContent value="admin">
              <div className="max-w-7xl mx-auto">
                {isAdmin ? <AdminPanel /> : null}
              </div>
            </TabsContent>
            <TabsContent value="profile">
              <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                <ProfileSettings userId={user.id} />
                <PasswordChange />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {activeTab === "profile" ? (
              <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                <ProfileSettings userId={user.id} />
                <PasswordChange />
              </div>
            ) : (
              <div className="max-w-7xl mx-auto">
                <LunchCalendar userId={user.id} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
