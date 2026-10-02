import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/admin/UserManagement";
import { InvitationManagement } from "@/components/admin/InvitationManagement";
import { CompanySettings } from "@/components/admin/CompanySettings";
import { WebflowSyncSettings } from "@/components/admin/WebflowSyncSettings";
import { StatisticsView } from "@/components/statistics/StatisticsView";

export const AdminPanel = () => {
  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full mb-8 grid-cols-2 md:grid-cols-5 h-auto">
        <TabsTrigger value="users">Brugere</TabsTrigger>
        <TabsTrigger value="invitations">Invitationer</TabsTrigger>
        <TabsTrigger value="settings">Indstillinger</TabsTrigger>
        <TabsTrigger value="webflow">Importer</TabsTrigger>
        <TabsTrigger value="statistics">Statistik</TabsTrigger>
      </TabsList>
      
      <TabsContent value="users">
        <UserManagement />
      </TabsContent>
      
      <TabsContent value="invitations">
        <InvitationManagement />
      </TabsContent>
      
      <TabsContent value="settings">
        <CompanySettings />
      </TabsContent>
      
      <TabsContent value="webflow">
        <WebflowSyncSettings />
      </TabsContent>
      
      <TabsContent value="statistics">
        <StatisticsView />
      </TabsContent>
    </Tabs>
  );
};
