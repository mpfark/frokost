import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Legacy redirect: vi bruger ikke længere adgangskoder.
 * Magic-linket fra invitationen etablerer sessionen og Supabase
 * processer auth-fragmentet automatisk uanset rute. Vi sender
 * brugeren videre til forsiden, hvor invitationen accepteres.
 */
export default function SetPassword() {
  const navigate = useNavigate();

  useEffect(() => {
    // Bevar evt. hash (auth-fragment) så Supabase kan læse den på forsiden.
    const hash = window.location.hash || "";
    navigate(`/${hash}`, { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Logger ind...</div>
    </div>
  );
}
