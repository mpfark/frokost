import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { ReminderSettings } from "@/components/settings/ReminderSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";

export const CompanySettings = () => {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full max-w-lg mx-auto mb-6 grid-cols-3">
        <TabsTrigger value="general">Generelt</TabsTrigger>
        <TabsTrigger value="reminders">Påmindelser</TabsTrigger>
        <TabsTrigger value="appearance">Udseende</TabsTrigger>
      </TabsList>
      
      <TabsContent value="general">
        <GeneralSettings />
      </TabsContent>
      
      <TabsContent value="reminders">
        <ReminderSettings />
      </TabsContent>
      
      <TabsContent value="appearance">
        <AppearanceSettings />
      </TabsContent>
    </Tabs>
  );
};