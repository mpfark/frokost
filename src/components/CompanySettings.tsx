import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Building2, Bell, Send, Palette } from "lucide-react";
import { ColorPicker } from "@/components/ColorPicker";

export const CompanySettings = () => {
  const [allowedDomain, setAllowedDomain] = useState("");
  const [weeksToDisplay, setWeeksToDisplay] = useState(3);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDay, setReminderDay] = useState(1); // 1 = Monday
  const [reminderHour, setReminderHour] = useState(8); // 08:00
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isTestingReminder, setIsTestingReminder] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("25 95% 37%");
  const [secondaryColor, setSecondaryColor] = useState("35 40% 90%");
  const [accentColor, setAccentColor] = useState("20 90% 48%");

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("allowed_domain, weeks_to_display, reminder_enabled, reminder_day, reminder_hour, primary_color, secondary_color, accent_color")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setAllowedDomain(data.allowed_domain);
        setWeeksToDisplay(data.weeks_to_display || 3);
        setReminderEnabled(data.reminder_enabled ?? true);
        setReminderDay(data.reminder_day ?? 1);
        setReminderHour(data.reminder_hour ?? 8);
        setPrimaryColor(data.primary_color || "25 95% 37%");
        setSecondaryColor(data.secondary_color || "35 40% 90%");
        setAccentColor(data.accent_color || "20 90% 48%");
      }
    } catch (error: any) {
      toast({
        title: "Error",
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

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(allowedDomain)) {
      toast({
        title: "Fejl",
        description: "Indtast venligst et gyldigt domæne (f.eks. virksomhed.dk)",
        variant: "destructive",
      });
      return;
    }

    // Validate weeks range
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
      // Check if settings exist
      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("company_settings")
          .update({ 
            allowed_domain: allowedDomain.toLowerCase(),
            weeks_to_display: weeksToDisplay,
            reminder_enabled: reminderEnabled,
            reminder_day: reminderDay,
            reminder_hour: reminderHour,
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            accent_color: accentColor
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("company_settings")
          .insert({ 
            allowed_domain: allowedDomain.toLowerCase(),
            weeks_to_display: weeksToDisplay,
            reminder_enabled: reminderEnabled,
            reminder_day: reminderDay,
            reminder_hour: reminderHour,
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            accent_color: accentColor
          });

        if (error) throw error;
      }

      toast({
        title: "Succes",
        description: "Virksomhedsindstillinger gemt med succes",
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

  const handleTestReminder = async () => {
    if (!testEmail.trim()) {
      toast({
        title: "Fejl",
        description: "Indtast venligst en email-adresse",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      toast({
        title: "Fejl",
        description: "Indtast venligst en gyldig email-adresse",
        variant: "destructive",
      });
      return;
    }

    setIsTestingReminder(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Du skal være logget ind");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-reminder-test`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ testEmail }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kunne ikke sende test-påmindelse');
      }

      const data = await response.json();

      toast({
        title: "Test-påmindelse sendt",
        description: data.message || "Påmindelser sendt til brugere uden tilmelding",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingReminder(false);
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
          Virksomhedsindstillinger
        </CardTitle>
        <CardDescription>
          Konfigurer det tilladte e-mail-domæne for bruger-tilmeldinger
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

        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Ugentlige påmindelser</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="reminder-enabled">Aktiver påmindelser</Label>
                <p className="text-sm text-muted-foreground">
                  Send automatiske emails til brugere uden frokost-tilmelding
                </p>
              </div>
              <Switch
                id="reminder-enabled"
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
                disabled={isLoading}
              />
            </div>

            {reminderEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reminder-day">Dag</Label>
                  <Select
                    value={reminderDay.toString()}
                    onValueChange={(value) => setReminderDay(parseInt(value))}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="reminder-day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Søndag</SelectItem>
                      <SelectItem value="1">Mandag</SelectItem>
                      <SelectItem value="2">Tirsdag</SelectItem>
                      <SelectItem value="3">Onsdag</SelectItem>
                      <SelectItem value="4">Torsdag</SelectItem>
                      <SelectItem value="5">Fredag</SelectItem>
                      <SelectItem value="6">Lørdag</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Hvilken dag skal påmindelser sendes
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminder-hour">Tidspunkt</Label>
                  <Select
                    value={reminderHour.toString()}
                    onValueChange={(value) => setReminderHour(parseInt(value))}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="reminder-hour">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Hvilket tidspunkt skal påmindelser sendes (24-timers format)
                  </p>
                </div>
              </>
            )}

            {reminderEnabled && (
              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="test-email">Test påmindelse</Label>
                  <p className="text-sm text-muted-foreground">
                    Send en test-påmindelse til en specifik email-adresse
                  </p>
                  <Input
                    id="test-email"
                    type="email"
                    placeholder="navn@virksomhed.dk"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    disabled={isTestingReminder}
                  />
                  <Button
                    onClick={handleTestReminder}
                    disabled={isTestingReminder}
                    variant="outline"
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isTestingReminder ? "Sender..." : "Send test-påmindelse"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Farvetema</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Tilpas farverne på hjemmesiden
          </p>
          
          <div className="space-y-4">
            <ColorPicker
              label="Primær farve"
              value={primaryColor}
              onChange={setPrimaryColor}
              disabled={isLoading}
            />
            <ColorPicker
              label="Sekundær farve"
              value={secondaryColor}
              onChange={setSecondaryColor}
              disabled={isLoading}
            />
            <ColorPicker
              label="Accent farve"
              value={accentColor}
              onChange={setAccentColor}
              disabled={isLoading}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? "Gemmer..." : "Gem indstillinger"}
        </Button>
      </CardContent>
    </Card>
  );
};