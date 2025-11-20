import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { InvitationManagement } from "@/components/InvitationManagement";
import { CompanySettings } from "@/components/CompanySettings";
import { WebflowSyncSettings } from "@/components/WebflowSyncSettings";

export const AdminPanel = () => {
  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full max-w-2xl mx-auto mb-8 grid-cols-2 md:grid-cols-4">
        <TabsTrigger value="users">Brugere</TabsTrigger>
        <TabsTrigger value="invitations">Invitationer</TabsTrigger>
        <TabsTrigger value="settings">Indstillinger</TabsTrigger>
        <TabsTrigger value="webflow">Webflow</TabsTrigger>
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
    </Tabs>
  );
};
