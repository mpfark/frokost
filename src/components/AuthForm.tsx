import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { UtensilsCrossed, AlertCircle } from "lucide-react";
import { signUpSchema, signInSchema, createSignUpWithInviteSchema } from "@/lib/validations";
import { z } from "zod";

export const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [allowedDomain, setAllowedDomain] = useState("");
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteChecking, setInviteChecking] = useState(false);
  const [emailFromInvite, setEmailFromInvite] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    // Parse URL fragment (hash) for invite parameters
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const invite = params.get("invite");
    const emailParam = params.get("email");

    if (invite) {
      setInviteCode(invite);
      setIsLogin(false);
      if (emailParam) {
        setEmail(emailParam);
        setEmailFromInvite(true);
      }
      validateInviteCode(invite, emailParam || "");
    }

    // Fetch company settings
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
      console.error("Error fetching company settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const validateInviteCode = async (code: string, emailToCheck: string) => {
    if (!code) return;

    setInviteChecking(true);
    try {
      // Use secure edge function instead of direct database query
      const { data, error } = await supabase.functions.invoke('validate-invitation', {
        body: { inviteCode: code, email: emailToCheck },
      });

      if (error) {
        toast.error("Der opstod en fejl under validering af invitationen");
        setInviteValid(false);
        return;
      }

      if (!data.valid) {
        toast.error(data.error || "Ugyldig eller udløbet invitation");
        setInviteValid(false);
        return;
      }

      setInviteValid(true);
    } catch (error: any) {
      toast.error("Der opstod en fejl under validering af invitationen");
      setInviteValid(false);
    } finally {
      setInviteChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const validationResult = signInSchema.safeParse({ email, password });
        if (!validationResult.success) {
          toast.error(validationResult.error.errors[0].message);
          setIsLoading(false);
          return;
        }

        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        // Signup with invite validation
        if (!allowedDomain) {
          toast.error("Virksomhedsdomæne ikke konfigureret. Kontakt venligst administrator.");
          setIsLoading(false);
          return;
        }

        if (!inviteCode) {
          toast.error("En invitationskode er påkrævet for at tilmelde dig");
          setIsLoading(false);
          return;
        }

        // Validate with domain schema
        const signUpWithInviteSchema = createSignUpWithInviteSchema(allowedDomain);
        const validationResult = signUpWithInviteSchema.safeParse({
          email,
          password,
          fullName,
          inviteCode,
        });

        if (!validationResult.success) {
          toast.error(validationResult.error.errors[0].message);
          setIsLoading(false);
          return;
        }

        // Validate invite one more time before signup using secure edge function
        const { data: validateData, error: validateError } = await supabase.functions.invoke('validate-invitation', {
          body: { inviteCode, email },
        });

        if (validateError || !validateData.valid) {
          toast.error(validateData?.error || "Denne invitationskode er ugyldig eller er allerede blevet brugt");
          setIsLoading(false);
          return;
        }

        // Create account
        const { data: authData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        toast.success("Konto oprettet! Du kan nu logge ind.");
      }
    } catch (error: any) {
      toast.error(error.message);
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
          <CardDescription>
            {isLogin ? "Log ind på din konto" : "Opret en ny konto"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLogin && inviteCode && inviteValid && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Du er blevet inviteret til at deltage i Plusfrokost!
              </AlertDescription>
            </Alert>
          )}
          
          {!isLogin && !inviteCode && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Tilmelding er kun på invitation. Kontakt venligst din administrator for et invitationslink.
              </AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Fulde navn</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  placeholder="Anders Andersen"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="dig@eksempel.dk"
                disabled={!isLogin && emailFromInvite}
              />
              {!isLogin && emailFromInvite && (
                <p className="text-xs text-muted-foreground">
                  Denne e-mail er låst til din invitation
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Adgangskode</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || (!isLogin && !inviteCode) || inviteChecking || (!isLogin && settingsLoading)}
            >
              {isLoading ? "Indlæser..." : settingsLoading && !isLogin ? "Indlæser indstillinger..." : isLogin ? "Log ind" : "Tilmeld"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? "Har du brug for en konto? Tilmeld dig" : "Har du allerede en konto? Log ind"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
