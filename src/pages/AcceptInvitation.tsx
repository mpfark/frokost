import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

const AcceptInvitation = () => {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "generating" | "error" | "expired">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!invitationId) {
      setStatus("error");
      setErrorMessage("Manglende invitation ID");
      return;
    }

    validateAndRedirect();
  }, [invitationId]);

  const validateAndRedirect = async () => {
    try {
      // Check if invitation exists and is valid
      const { data: invitation, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("id", invitationId)
        .single();

      if (error || !invitation) {
        setStatus("error");
        setErrorMessage("Invitationen blev ikke fundet");
        return;
      }

      // Check if already accepted
      if (invitation.status === "accepted") {
        setStatus("error");
        setErrorMessage("Denne invitation er allerede blevet accepteret. Log ind med din email og adgangskode.");
        return;
      }

      // Check if expired (7 days from invited_at)
      const expiresAt = new Date(invitation.expires_at);
      if (new Date() > expiresAt) {
        setStatus("expired");
        return;
      }

      // Generate fresh magic link and redirect
      setStatus("generating");
      
      const { data, error: linkError } = await supabase.functions.invoke("generate-invite-link", {
        body: { invitationId: invitation.id },
      });

      if (linkError || !data?.link) {
        console.error("Failed to generate link:", linkError);
        setStatus("error");
        setErrorMessage("Kunne ikke generere login-link. Prøv igen eller kontakt en administrator.");
        return;
      }

      // Redirect to the magic link
      window.location.href = data.link;
    } catch (err: any) {
      console.error("Error validating invitation:", err);
      setStatus("error");
      setErrorMessage(err.message || "Der opstod en uventet fejl");
    }
  };

  const handleRetry = () => {
    setStatus("loading");
    validateAndRedirect();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {status === "loading" && "Validerer invitation..."}
            {status === "generating" && "Forbereder login..."}
            {status === "error" && "Fejl"}
            {status === "expired" && "Invitation udløbet"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Vent venligst mens vi tjekker din invitation"}
            {status === "generating" && "Du vil blive viderestillet om et øjeblik"}
            {status === "error" && "Der opstod et problem"}
            {status === "expired" && "Denne invitation er ikke længere gyldig"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {(status === "loading" || status === "generating") && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}

          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-muted-foreground">{errorMessage}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/")}>
                  Gå til login
                </Button>
                <Button onClick={handleRetry}>
                  Prøv igen
                </Button>
              </div>
            </>
          )}

          {status === "expired" && (
            <>
              <AlertCircle className="h-12 w-12 text-warning" />
              <p className="text-center text-muted-foreground">
                Din invitation er udløbet. Kontakt venligst en administrator for at få tilsendt en ny invitation.
              </p>
              <Button onClick={() => navigate("/")}>
                Gå til login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;
