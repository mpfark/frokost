import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";

export const AuthForm = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleMicrosoftSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("microsoft", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Microsoft-login mislykkedes. Prøv igen eller kontakt en administrator.");
      }
    } catch {
      toast.error("Kunne ikke starte Microsoft-login. Prøv igen om lidt.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <UtensilsCrossed className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Plusfrokost</CardTitle>
          <CardDescription>Log ind med din Microsoft-arbejdskonto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" className="w-full" onClick={handleMicrosoftSignIn} disabled={isLoading}>
            <svg className="w-4 h-4" viewBox="0 0 23 23" aria-hidden="true">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            {isLoading ? "Åbner Microsoft-login..." : "Log ind med Microsoft"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Brug samme arbejdsmail som på din invitation. Kontakt en administrator, hvis du mangler adgang.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
