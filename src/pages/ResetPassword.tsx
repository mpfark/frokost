import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UtensilsCrossed } from "lucide-react";
import { z } from "zod";
import { strongPasswordSchema } from "@/lib/validations";

const passwordResetSchema = z.object({
  password: strongPasswordSchema,
  confirmPassword: z.string().min(1, "Bekræft venligst din adgangskode"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Adgangskoderne stemmer ikke overens",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidSession, setIsValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user is in password recovery mode
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if this is a recovery session
      if (session) {
        setIsValidSession(true);
      } else {
        toast.error("Ugyldigt eller udløbet link til nulstilling af adgangskode");
        setTimeout(() => navigate("/"), 2000);
      }
      setIsCheckingSession(false);
    };

    checkSession();
  }, [navigate]);

  const handleResetPassword = async () => {
    setIsLoading(true);

    try {
      const validationResult = passwordResetSchema.safeParse({
        password,
        confirmPassword,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setIsLoading(false);
        return;
      }

      // Update password - this works when user is in recovery mode
      const { error } = await supabase.auth.updateUser({
        password: validationResult.data.password,
      });

      if (error) {
        toast.error("Kunne ikke nulstille adgangskode");
      } else {
        toast.success("Adgangskode nulstillet med succes!");
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (error) {
      toast.error("Der opstod en fejl under nulstilling af adgangskode");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Verificerer nulstillingslink...</div>
      </div>
    );
  }

  if (!isValidSession) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Plusfrokost</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nulstil din adgangskode</CardTitle>
            <CardDescription>Indtast din nye adgangskode nedenfor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Ny adgangskode</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Indtast ny adgangskode"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bekræft ny adgangskode</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Bekræft ny adgangskode"
              />
            </div>

            <Button onClick={handleResetPassword} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Nulstiller...
                </>
              ) : (
                "Nulstil adgangskode"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
