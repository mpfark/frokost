import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/UserManagement";
import { InvitationManagement } from "@/components/InvitationManagement";
import { CompanySettings } from "@/components/CompanySettings";

export const AdminPanel = () => {
  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full max-w-2xl mx-auto mb-8 grid-cols-3">
        <TabsTrigger value="users">Brugere</TabsTrigger>
        <TabsTrigger value="invitations">Invitationer</TabsTrigger>
        <TabsTrigger value="settings">Indstillinger</TabsTrigger>
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
    </Tabs>
  );
};
