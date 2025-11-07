import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { AuthForm } from "@/components/AuthForm";
import { initializeTeams, detectTeamsContext } from "@/lib/teams-context";
import { LunchCalendar } from "@/components/LunchCalendar";
import { KitchenView } from "@/components/KitchenView";
import { ProfileSettings } from "@/components/ProfileSettings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInTeams, setIsInTeams] = useState(false);

  useEffect(() => {
    // Initialize Teams context if applicable
    initializeTeams().then((context) => {
      setIsInTeams(context.isInTeams);
    });

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

  if (isLoading) {
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
    <div className="min-h-screen bg-background">
      {!isInTeams && (
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
      )}

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="calendar">My Schedule</TabsTrigger>
            <TabsTrigger value="kitchen">Kitchen View</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar">
            <LunchCalendar userId={user.id} />
          </TabsContent>
          <TabsContent value="kitchen">
            <KitchenView />
          </TabsContent>
          <TabsContent value="profile">
            <div className="max-w-2xl mx-auto">
              <ProfileSettings userId={user.id} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
