import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

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
        "Brugeren findes ikke endnu. Brug 'Inviter ny platform admin' nedenfor.",
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

  const invite = async () => {
    const target = inviteEmail.trim().toLowerCase();
    if (!target) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-platform-admin", {
      body: { email: target },
    });
    setInviting(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Invitation fejlede");
    }
    toast.success(
      (data as any)?.existed
        ? `${target} er nu platform admin (login-link sendt)`
        : `Invitation sendt til ${target}`,
    );
    setInviteEmail("");
    setInviteOpen(false);
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
          Platform admins har adgang til denne side og kan styre alle tenants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email"
            placeholder="Eksisterende bruger: bruger@eksempel.dk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAdmin()}
          />
          <Button onClick={addAdmin} disabled={adding || !email.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Tilføj
          </Button>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Mail className="h-4 w-4" />
              Inviter ny platform admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter ny platform admin</DialogTitle>
              <DialogDescription>
                Vi sender en invitation pr. email. Når modtageren accepterer, får de automatisk
                platform admin-rollen.
              </DialogDescription>
            </DialogHeader>
            <Input
              type="email"
              placeholder="bruger@eksempel.dk"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>
                Annullér
              </Button>
              <Button onClick={invite} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Send invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
