import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { AuthForm } from "@/components/AuthForm";
import { LunchCalendar } from "@/components/LunchCalendar";
import { KitchenView } from "@/components/KitchenView";
import { ProfileSettings } from "@/components/ProfileSettings";
import { UserManagement } from "@/components/UserManagement";
import { InvitationManagement } from "@/components/InvitationManagement";
import { CompanySettings } from "@/components/CompanySettings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAdmin, isLoading: isRoleLoading } = useUserRole(user?.id);

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
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className={`grid w-full max-w-4xl mx-auto mb-8 h-auto ${isAdmin ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2'}`}>
            <TabsTrigger value="calendar" className="text-xs sm:text-sm">My Schedule</TabsTrigger>
            {isAdmin && <TabsTrigger value="kitchen" className="text-xs sm:text-sm">Kitchen View</TabsTrigger>}
            {isAdmin && <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>}
            {isAdmin && <TabsTrigger value="invites" className="text-xs sm:text-sm">Invitations</TabsTrigger>}
            {isAdmin && <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>}
            <TabsTrigger value="profile" className="text-xs sm:text-sm">Profile</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar">
            <div className="max-w-7xl mx-auto">
              <LunchCalendar userId={user.id} />
            </div>
          </TabsContent>
          {isAdmin && (
            <TabsContent value="kitchen">
              <div className="max-w-7xl mx-auto">
                <KitchenView />
              </div>
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="users">
              <div className="max-w-7xl mx-auto">
                <UserManagement />
              </div>
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="invites">
              <div className="max-w-7xl mx-auto">
                <InvitationManagement />
              </div>
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="settings">
              <div className="max-w-7xl mx-auto">
                <CompanySettings />
              </div>
            </TabsContent>
          )}
          <TabsContent value="profile">
            <div className="max-w-7xl mx-auto">
              <ProfileSettings userId={user.id} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
