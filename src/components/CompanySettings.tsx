import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";

export const CompanySettings = () => {
  const [allowedDomain, setAllowedDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("allowed_domain")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setAllowedDomain(data.allowed_domain);
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
        title: "Error",
        description: "Please enter a domain",
        variant: "destructive",
      });
      return;
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(allowedDomain)) {
      toast({
        title: "Error",
        description: "Please enter a valid domain (e.g., company.com)",
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
          .update({ allowed_domain: allowedDomain.toLowerCase() })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("company_settings")
          .insert({ allowed_domain: allowedDomain.toLowerCase() });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Company settings saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Settings
        </CardTitle>
        <CardDescription>
          Configure the allowed email domain for user signups
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="domain">Allowed Email Domain</Label>
          <div className="flex gap-2">
            <span className="flex items-center text-muted-foreground">@</span>
            <Input
              id="domain"
              placeholder="company.com"
              value={allowedDomain}
              onChange={(e) => setAllowedDomain(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Only users with email addresses from this domain will be able to sign up
          </p>
        </div>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
};