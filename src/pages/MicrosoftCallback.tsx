import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MicrosoftCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");

      if (error) {
        console.error("Microsoft auth error:", error, params.get("error_description"));
        toast.error("Microsoft-login mislykkedes");
        setStatus("error");
        setTimeout(() => navigate("/?tab=profile"), 2000);
        return;
      }

      if (!code) {
        toast.error("Ingen autorisationskode modtaget");
        setStatus("error");
        setTimeout(() => navigate("/?tab=profile"), 2000);
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/microsoft-callback`;

        const { data, error: fnError } = await supabase.functions.invoke(
          "microsoft-auth-callback",
          { body: { code, redirectUri } }
        );

        if (fnError || data?.error) {
          throw new Error(data?.error || fnError?.message || "Ukendt fejl");
        }

        toast.success("Outlook-kalender forbundet!");
        setStatus("success");
        setTimeout(() => navigate("/?tab=profile"), 1000);
      } catch (err: any) {
        console.error("Callback error:", err);
        toast.error("Kunne ikke forbinde kalender");
        setStatus("error");
        setTimeout(() => navigate("/?tab=profile"), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground">Forbinder Outlook-kalender...</p>
          </>
        )}
        {status === "success" && (
          <p className="text-primary font-medium">✓ Kalender forbundet! Sender dig tilbage...</p>
        )}
        {status === "error" && (
          <p className="text-destructive font-medium">Noget gik galt. Sender dig tilbage...</p>
        )}
      </div>
    </div>
  );
};

export default MicrosoftCallback;
