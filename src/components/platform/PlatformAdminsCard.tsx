import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface AdminRow {
  user_id: string;
  email: string;
  full_name: string | null;
}

export const PlatformAdminsCard = ({ currentUserId }: { currentUserId: string }) => {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "platform_admin");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setAdmins([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .in("id", ids);
    setAdmins(
      (profs ?? []).map((p) => ({ user_id: p.id, email: p.email, full_name: p.full_name })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addAdmin = async () => {
    const target = email.trim().toLowerCase();
    if (!target) return;
    setAdding(true);
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id,email")
      .ilike("email", target)
      .maybeSingle();
    if (pErr || !prof) {
      setAdding(false);
      return toast.error(
        "Brugeren findes ikke endnu. Bed dem først oprette en konto på frokost.gakgak.net.",
      );
    }
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: prof.id, role: "platform_admin" });
    setAdding(false);
    if (error && !error.message.includes("duplicate")) {
      return toast.error("Kunne ikke tilføje rollen: " + error.message);
    }
    toast.success(`${prof.email} er nu platform admin`);
    setEmail("");
    load();
  };

  const removeAdmin = async (userId: string, userEmail: string) => {
    if (userId === currentUserId) {
      return toast.error("Du kan ikke fjerne dig selv");
    }
    if (!confirm(`Fjern platform admin-rollen fra ${userEmail}?`)) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "platform_admin");
    if (error) return toast.error("Kunne ikke fjerne rollen");
    toast.success("Rollen er fjernet");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Platform administratorer
        </CardTitle>
        <CardDescription>
          Platform admins har adgang til denne side og kan styre alle tenants. Brugeren skal først
          have oprettet en konto på frokost.gakgak.net før de kan promoveres.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email"
            placeholder="bruger@eksempel.dk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAdmin()}
          />
          <Button onClick={addAdmin} disabled={adding || !email.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Tilføj
          </Button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div
                key={a.user_id}
                className="flex items-center justify-between gap-2 p-3 rounded-md border bg-card"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.full_name ?? a.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {a.user_id === currentUserId && <Badge variant="secondary">Dig</Badge>}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAdmin(a.user_id, a.email)}
                    disabled={a.user_id === currentUserId}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
