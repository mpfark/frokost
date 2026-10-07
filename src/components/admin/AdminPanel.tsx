import { HeaderSubnavigation } from "@/components/layout/HeaderSubnavigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/admin/UserManagement";
import { InvitationManagement } from "@/components/admin/InvitationManagement";
import { CompanySettings } from "@/components/admin/CompanySettings";
import { WebflowSyncSettings } from "@/components/admin/WebflowSyncSettings";
import { StatisticsView } from "@/components/statistics/StatisticsView";

export const AdminPanel = () => {
  return (
    <Tabs defaultValue="users" className="w-full">
      <HeaderSubnavigation>
      <TabsList aria-label="Administration" className="app-subnav">
        <TabsTrigger value="users">Brugere</TabsTrigger>
        <TabsTrigger value="invitations">Invitationer</TabsTrigger>
        <TabsTrigger value="settings">Indstillinger</TabsTrigger>
        <TabsTrigger value="webflow">Importer</TabsTrigger>
        <TabsTrigger value="statistics">Statistik</TabsTrigger>
      </TabsList>
      </HeaderSubnavigation>
      
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
