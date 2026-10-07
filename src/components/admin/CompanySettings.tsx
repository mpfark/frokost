import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/admin/settings/GeneralSettings";
import { ReminderSettings } from "@/components/admin/settings/ReminderSettings";

export const CompanySettings = () => {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full mb-6 grid-cols-2">
        <TabsTrigger value="general">Generelt</TabsTrigger>
        <TabsTrigger value="reminders">Påmindelser</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralSettings />
      </TabsContent>

      <TabsContent value="reminders">
        <ReminderSettings />
      </TabsContent>
    </Tabs>
  );
};
