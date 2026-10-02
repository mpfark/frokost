import { AuthForm } from "@/components/auth/AuthForm";
import { LunchCalendar } from "@/components/lunch/LunchCalendar";
import { KitchenView } from "@/components/kitchen/KitchenView";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { OutlookCalendar } from "@/components/catering/OutlookCalendar";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { useAppSession } from "@/components/layout/AppSession";

const Index = () => {
  const {user,isLoading,isAdmin,canAccessKitchen,activeTab} = useAppSession();
  if (isLoading) return <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8"><p role="status" className="animate-pulse text-muted-foreground">Indlæser…</p></main>;
  if (!user) return <AuthForm />;
  return <main className="mx-auto min-w-0 max-w-[1400px] p-4 sm:p-6 lg:p-8">
    <div className={activeTab === "profile" ? "mx-auto max-w-4xl" : "mx-auto max-w-7xl"}>
      {activeTab === "calendar" && <LunchCalendar userId={user.id} />}
      {activeTab === "outlook" && user.email && <OutlookCalendar userEmail={user.email} />}
      {activeTab === "kitchen" && canAccessKitchen && <KitchenView />}
      {activeTab === "admin" && isAdmin && <AdminPanel />}
      {activeTab === "profile" && <ProfileSettings userId={user.id} />}
    </div>
  </main>;
};
export default Index;
