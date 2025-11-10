import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { AuthForm } from "@/components/AuthForm";
import { LunchCalendar } from "@/components/LunchCalendar";
import { KitchenView } from "@/components/KitchenView";
import { ProfileSettings } from "@/components/ProfileSettings";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, UtensilsCrossed, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("calendar");
  const { isAdmin, isKitchen, isLoading: isRoleLoading } = useUserRole(user?.id);
  const canAccessKitchen = isAdmin || isKitchen;

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
    toast.success("Signed out successfully");
  };

  if (isLoading || isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Office Lunch</h1>
                <p className="text-sm text-muted-foreground">Next 3 weeks schedule</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setActiveTab("profile")}>
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
            <TabsList className={`grid w-full max-w-4xl mx-auto mb-8 h-auto ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="calendar" className="text-xs sm:text-sm">My Schedule</TabsTrigger>
              {canAccessKitchen && <TabsTrigger value="kitchen" className="text-xs sm:text-sm">Kitchen View</TabsTrigger>}
              {isAdmin && <TabsTrigger value="admin" className="text-xs sm:text-sm">Admin</TabsTrigger>}
            </TabsList>
            <TabsContent value="calendar">
              <div className="max-w-7xl mx-auto">
                <LunchCalendar userId={user.id} />
              </div>
            </TabsContent>
            <TabsContent value="kitchen">
              <div className="max-w-7xl mx-auto">
                {canAccessKitchen ? <KitchenView /> : null}
              </div>
            </TabsContent>
            <TabsContent value="admin">
              <div className="max-w-7xl mx-auto">
                {isAdmin ? <AdminPanel /> : null}
              </div>
            </TabsContent>
            <TabsContent value="profile">
              <div className="max-w-7xl mx-auto">
                <ProfileSettings userId={user.id} />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {activeTab === "profile" ? (
              <div className="max-w-7xl mx-auto">
                <ProfileSettings userId={user.id} />
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
