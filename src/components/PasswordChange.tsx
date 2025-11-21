import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { strongPasswordSchema } from "@/lib/validations";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Nuværende adgangskode er påkrævet"),
  newPassword: strongPasswordSchema,
  confirmPassword: z.string().min(1, "Bekræft venligst din adgangskode"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Adgangskoderne stemmer ikke overens",
  path: ["confirmPassword"],
});

export const PasswordChange = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Fetch user email on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });
  }, []);

  const handleChangePassword = async () => {
    setIsLoading(true);

    try {
      const validationResult = passwordChangeSchema.safeParse({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setIsLoading(false);
        return;
      }

      // Update password - Supabase handles authentication
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message || "Kunne ikke opdatere adgangskode");
        console.error("Password update error:", error);
      } else {
        toast.success("Adgangskode opdateret med succes!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      toast.error("Der opstod en fejl under opdatering af adgangskode");
      console.error("Password change error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skift adgangskode</CardTitle>
        <CardDescription>Opdater din kontoadgangskode</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={userEmail}
            disabled
            autoComplete="username"
            className="bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentPassword">Nuværende adgangskode</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Indtast nuværende adgangskode"
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">Ny adgangskode</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Indtast ny adgangskode"
            autoComplete="new-password"
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
            autoComplete="new-password"
          />
        </div>

        <Button onClick={handleChangePassword} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Opdaterer...
            </>
          ) : (
            "Opdater adgangskode"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
