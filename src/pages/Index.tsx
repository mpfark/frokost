import { AuthForm } from "@/components/auth/AuthForm";
import { LunchCalendar } from "@/components/lunch/LunchCalendar";
import { KitchenView } from "@/components/kitchen/KitchenView";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { OutlookCalendar } from "@/components/catering/OutlookCalendar";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { useAppSession } from "@/components/layout/AppSession";

const Index = () => {
  const {user,isLoading,isAdmin,canAccessKitchen,activeTab} = useAppSession();
  if (isLoading) return <main className="app-content"><p role="status" className="animate-pulse text-muted-foreground">Indlæser…</p></main>;
  if (!user) return <AuthForm />;
  return <main className="app-content">
    <div className="w-full min-w-0">
      {activeTab === "calendar" && <LunchCalendar userId={user.id} />}
      {activeTab === "outlook" && user.email && <OutlookCalendar userEmail={user.email} />}
      {activeTab === "kitchen" && canAccessKitchen && <KitchenView />}
      {activeTab === "admin" && isAdmin && <AdminPanel />}
      {activeTab === "profile" && <ProfileSettings userId={user.id} />}
    </div>
  </main>;
};
export default Index;
