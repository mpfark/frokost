import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { MeetingRoomSelector } from "./MeetingRoomSelector";

export const GeneralSettings = () => {
  const [allowedDomain, setAllowedDomain] = useState("");
  const [weeksToDisplay, setWeeksToDisplay] = useState(3);
  const [restrictSignupToDomain, setRestrictSignupToDomain] = useState(true);
  const [resourceRoomEmails, setResourceRoomEmails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("allowed_domain, weeks_to_display, resource_room_emails, restrict_signup_to_domain")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setAllowedDomain(data.allowed_domain);
        setWeeksToDisplay(data.weeks_to_display || 3);
        setResourceRoomEmails((data as any).resource_room_emails || []);
      }
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    if (!allowedDomain.trim()) {
      toast({
        title: "Fejl",
        description: "Indtast venligst et domæne",
        variant: "destructive",
      });
      return;
    }

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(allowedDomain)) {
      toast({
        title: "Fejl",
        description: "Indtast venligst et gyldigt domæne (f.eks. virksomhed.dk)",
        variant: "destructive",
      });
      return;
    }

    if (weeksToDisplay < 1 || weeksToDisplay > 8) {
      toast({
        title: "Fejl",
        description: "Antal uger skal være mellem 1 og 8",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .single();

      const payload = { 
        allowed_domain: allowedDomain.toLowerCase(),
        weeks_to_display: weeksToDisplay,
        resource_room_emails: resourceRoomEmails,
      };

      if (existing) {
        const { error } = await supabase
          .from("company_settings")
          .update(payload)
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_settings")
          .insert(payload);

        if (error) throw error;
      }

      toast({
        title: "Succes",
        description: "Generelle indstillinger gemt",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div>Indlæser...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Generelle indstillinger
        </CardTitle>
        <CardDescription>
          Konfigurer virksomhedens grundlæggende indstillinger
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="domain">Tilladt e-mail-domæne</Label>
          <div className="flex gap-2">
            <span className="flex items-center text-muted-foreground">@</span>
            <Input
              id="domain"
              placeholder="virksomhed.dk"
              value={allowedDomain}
              onChange={(e) => setAllowedDomain(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Kun brugere med e-mailadresser fra dette domæne vil kunne tilmelde sig
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="weeks">Antal uger i kalender</Label>
          <Input
            id="weeks"
            type="number"
            min="1"
            max="8"
            placeholder="3"
            value={weeksToDisplay}
            onChange={(e) => setWeeksToDisplay(parseInt(e.target.value) || 3)}
            disabled={isLoading}
          />
          <p className="text-sm text-muted-foreground">
            Antallet af uger der vises i brugerens frokostkalender (1-8)
          </p>
        </div>

        <MeetingRoomSelector
          selectedEmails={resourceRoomEmails}
          onSelectionChange={setResourceRoomEmails}
          disabled={isLoading}
        />

        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          {isLoading ? "Gemmer..." : "Gem indstillinger"}
        </Button>
      </CardContent>
    </Card>
  );
};
