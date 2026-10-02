import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (res.ok && data.valid) {
          setStatus(data.already_unsubscribed ? "already" : "valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("error");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    try {
      const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <main className="app-content min-h-[50vh] flex items-center justify-center">
      <div className="w-full bg-card rounded-lg shadow-sm border p-8 text-center">
        <div className="text-3xl mb-4">🍽</div>
        <h1 className="text-xl font-bold text-foreground mb-2">Plusfrokost</h1>

        {status === "loading" && (
          <p className="text-muted-foreground">Validerer...</p>
        )}

        {status === "valid" && (
          <>
            <p className="text-muted-foreground mb-6">
              Vil du afmelde dig fra e-mail-notifikationer?
            </p>
            <button
              onClick={handleUnsubscribe}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Bekræft afmelding
            </button>
          </>
        )}

        {status === "already" && (
          <p className="text-muted-foreground">Du er allerede afmeldt.</p>
        )}

        {status === "success" && (
          <p className="text-muted-foreground">
            Du er nu afmeldt e-mail-notifikationer.
          </p>
        )}

        {status === "invalid" && (
          <p className="text-destructive">Ugyldigt eller udløbet link.</p>
        )}

        {status === "error" && (
          <p className="text-destructive">Der opstod en fejl. Prøv igen senere.</p>
        )}
      </div>
    </main>
  );
};

export default Unsubscribe;
