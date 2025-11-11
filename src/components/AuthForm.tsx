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
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
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
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("invite_code", code)
        .eq("status", "pending")
        .single();

      if (error || !data) {
        toast.error("This invitation code is invalid or has expired");
        setInviteValid(false);
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        toast.error("This invitation has expired");
        setInviteValid(false);
        return;
      }

      // Check if email matches
      if (emailToCheck && data.email.toLowerCase() !== emailToCheck.toLowerCase()) {
        toast.error("This invitation was sent to a different email address");
        setInviteValid(false);
        return;
      }

      setInviteValid(true);
    } catch (error: any) {
      console.error("Error validating invite:", error);
      setInviteValid(false);
    } finally {
      setInviteChecking(false);
    }
  };
  
  // Attempt to mark a pending invitation as accepted for the current user
  const acceptPendingInvitation = async (userId: string, userEmail: string) => {
    try {
      // Find the most recent pending invite for this email
      const { data: pendingInvite } = await supabase
        .from("invitations")
        .select("id, expires_at")
        .eq("email", userEmail.toLowerCase())
        .eq("status", "pending")
        .order("invited_at", { ascending: false })
        .limit(1)
        .single();

      if (!pendingInvite) return; // nothing to accept

      // Skip expired
      if (new Date(pendingInvite.expires_at) < new Date()) return;

      const { error: updateError } = await supabase
        .from("invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          used_by: userId,
        })
        .eq("id", pendingInvite.id);

      if (updateError) {
        console.warn("Failed to mark invitation as accepted:", updateError);
      }
    } catch (err) {
      console.warn("Error while accepting pending invitation:", err);
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

        // On first successful login, accept any pending invitation for this email
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (user?.email) {
          await acceptPendingInvitation(user.id, user.email);
        }
      } else {
        // Signup with invite validation
        if (!allowedDomain) {
          toast.error("Company domain not configured. Please contact administrator.");
          setIsLoading(false);
          return;
        }

        if (!inviteCode) {
          toast.error("An invitation code is required to sign up");
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

        // Validate invite one more time
        const { data: inviteData, error: inviteError } = await supabase
          .from("invitations")
          .select("*")
          .eq("invite_code", inviteCode)
          .eq("status", "pending")
          .single();

        if (inviteError || !inviteData) {
          toast.error("This invitation code is invalid or has already been used");
          setIsLoading(false);
          return;
        }

        if (inviteData.email.toLowerCase() !== email.toLowerCase()) {
          toast.error("This invitation was sent to a different email address");
          setIsLoading(false);
          return;
        }

        if (new Date(inviteData.expires_at) < new Date()) {
          toast.error("This invitation has expired");
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

        // Mark invitation as accepted
        if (authData.user) {
          await supabase
            .from("invitations")
            .update({
              status: "accepted",
              accepted_at: new Date().toISOString(),
              used_by: authData.user.id,
            })
            .eq("id", inviteData.id);
        }

        toast.success("Account created! You can now log in.");
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
          <CardTitle className="text-2xl">Office Lunch</CardTitle>
          <CardDescription>
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLogin && inviteCode && inviteValid && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You've been invited to join Office Lunch!
              </AlertDescription>
            </Alert>
          )}
          
          {!isLogin && !inviteCode && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Sign up is by invitation only. Please contact your administrator for an invite link.
              </AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  placeholder="John Doe"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                disabled={!isLogin && emailFromInvite}
              />
              {!isLogin && emailFromInvite && (
                <p className="text-xs text-muted-foreground">
                  This email is locked to your invitation
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
              {isLoading ? "Loading..." : settingsLoading && !isLogin ? "Loading settings..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
