import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UtensilsCrossed, Info } from "lucide-react";
import { strongPasswordSchema } from "@/lib/validations";
import { z } from "zod";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const passwordSchema = z.object({
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords må være ens",
  path: ["confirmPassword"],
});

export default function SetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [linkExpired, setLinkExpired] = useState(false);
  const isIntentionalSignOut = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let mounted = true;
    let sessionEstablished = false;

    // Check for error in URL fragment (e.g., OTP expired)
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const error = hashParams.get('error');
    const errorCode = hashParams.get('error_code');
    
    if (error === 'access_denied' && errorCode === 'otp_expired') {
      console.log("SetPassword: OTP expired error detected in URL");
      setLinkExpired(true);
      setIsCheckingSession(false);
      return; // Stop further processing
    }

    // Check if URL contains auth tokens (magic link)
    const hasAuthFragment = window.location.hash.includes('access_token') || 
                            window.location.hash.includes('type=');

    console.log("SetPassword: Initializing, hasAuthFragment:", hasAuthFragment);

    // Listen for auth state changes (handles magic link authentication)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("SetPassword: Auth state changed:", event, session?.user?.email);
      
      // Handle successful authentication
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session) {
        if (mounted && !sessionEstablished) {
          sessionEstablished = true;
          setSession(session);
          setIsCheckingSession(false);
          clearTimeout(timeoutId);
          console.log("SetPassword: Session established successfully");
        }
      } else if (event === 'SIGNED_OUT' && sessionEstablished) {
        // Ignore sign-out if it's part of the password setting flow
        if (isIntentionalSignOut.current) {
          return;
        }
        // Only redirect if we previously had a session
        if (mounted) {
          toast.error("Session udløbet. Prøv at klikke på linket i emailen igen.");
          navigate("/");
        }
      }
    });

    // If no auth fragment in URL, check for existing session
    if (!hasAuthFragment) {
      console.log("SetPassword: No auth fragment, checking existing session");
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && mounted && !sessionEstablished) {
          sessionEstablished = true;
          setSession(session);
          setIsCheckingSession(false);
          clearTimeout(timeoutId);
          console.log("SetPassword: Found existing session");
        }
      });
    } else {
      console.log("SetPassword: Auth fragment detected, waiting for Supabase to process...");
    }

    // Generous timeout (30 seconds) - give Supabase time to process the magic link
    timeoutId = setTimeout(() => {
      if (!sessionEstablished && mounted) {
        console.log("SetPassword: Timeout reached without session");
        setIsCheckingSession(false);
        // Show expired link page instead of redirecting
        setLinkExpired(true);
      }
    }, 30000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate passwords
      passwordSchema.parse({ password, confirmPassword });

      if (!session?.user) {
        throw new Error("Ingen aktiv session");
      }

      // Update user password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      // Sign out the magic link session
      isIntentionalSignOut.current = true;
      await supabase.auth.signOut();

      // Sign in with the new password to establish a proper session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email!,
        password: password,
      });

      if (signInError) throw signInError;

      // Mark the invitation as accepted AFTER successful sign-in with new credentials
      console.log("Attempting to accept invitation for:", session.user.email);

      let invitationUpdated = false;

      try {
        const { data: inviteData, error: inviteError } = await supabase.functions.invoke(
          "accept-invitation"
        );

        if (inviteError) {
          console.error("Failed to call accept-invitation function:", inviteError);
        } else if (!inviteData?.success) {
          console.warn("Invitation not found or already accepted:", inviteData);
          // Don't show error to user if invitation doesn't exist - they can still use the app
          console.warn("User kan stadig få adgang til appen");
        } else {
          console.log("Invitation accepted successfully via function:", inviteData.invitationId);
          invitationUpdated = true;
        }
      } catch (acceptError) {
        console.error("Unexpected error when calling accept-invitation function:", acceptError);
      }

      // Fallback: attempt to update the invitation directly from the client as the authenticated user
      if (!invitationUpdated) {
        console.log("Falling back to direct invitation update for:", session.user.email);
        const { data, error } = await supabase
          .from("invitations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            used_by: session.user.id,
          })
          .eq("status", "pending")
          .select("id");

        if (error) {
          console.error("Fallback invitation update failed:", error);
          toast.error("Kunne ikke opdatere invitation. Kontakt en administrator.");
        } else if (!data || data.length === 0) {
          console.warn("Fallback: No pending invitation found for this user.");
        } else {
          console.log("Fallback: Invitation accepted successfully:", data[0]?.id);
        }
      }


      toast.success("Adgangskode sat! Du er nu logget ind.");
      navigate("/");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Der opstod en fejl");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Verificerer invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    if (linkExpired) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-destructive/10 p-3 rounded-full">
                  <Info className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Linket er udløbet</CardTitle>
              <CardDescription>
                Dit invitationslink er desværre udløbet eller allerede brugt. 
                Kontakt venligst din administrator for at få tilsendt et nyt link.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                Gå til login
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <UtensilsCrossed className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Sæt din adgangskode</CardTitle>
          <CardDescription>
            Velkommen til Plusfrokost! Vælg en sikker adgangskode til din konto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="password">Adgangskode</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold mb-1">Adgangskoden skal indeholde:</p>
                      <ul className="text-sm space-y-1">
                        <li>• Mindst 8 tegn</li>
                        <li>• Mindst ét stort bogstav</li>
                        <li>• Mindst ét lille bogstav</li>
                        <li>• Mindst ét tal</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindst 8 tegn"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bekræft adgangskode</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Indtast adgangskode igen"
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Gemmer..." : "Fortsæt"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
