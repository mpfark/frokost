import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AuthForm } from "@/components/auth/AuthForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Building2, ExternalLink } from "lucide-react";
import { MODULE_REGISTRY, ModuleKey } from "@/modules/registry";
import { PlatformAdminsCard } from "@/components/platform/PlatformAdminsCard";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface Company {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  is_active: boolean;
}

interface CompanyModule {
  company_id: string;
  module_key: string;
  is_enabled: boolean;
}

const Platform = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { isPlatformAdmin, isLoading: roleLoading } = useUserRole(user?.id);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [modules, setModules] = useState<CompanyModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [c, m] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("company_modules").select("*"),
    ]);
    if (c.data) setCompanies(c.data as Company[]);
    if (m.data) setModules(m.data as CompanyModule[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isPlatformAdmin) loadData();
  }, [isPlatformAdmin]);

  const isEnabled = (companyId: string, key: ModuleKey) =>
    modules.some((m) => m.company_id === companyId && m.module_key === key && m.is_enabled);

  const toggleModule = async (companyId: string, key: ModuleKey, enabled: boolean) => {
    const existing = modules.find((m) => m.company_id === companyId && m.module_key === key);
    if (existing) {
      const { error } = await supabase
        .from("company_modules")
        .update({ is_enabled: enabled })
        .eq("company_id", companyId)
        .eq("module_key", key);
      if (error) return toast.error("Kunne ikke opdatere modul");
    } else {
      const { error } = await supabase
        .from("company_modules")
        .insert({ company_id: companyId, module_key: key, is_enabled: enabled });
      if (error) return toast.error("Kunne ikke oprette modul");
    }
    toast.success("Modul opdateret");
    loadData();
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/30 p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Shield className="h-10 w-10 mx-auto mb-2 text-primary" />
            <h1 className="text-2xl font-bold">Platform Admin</h1>
            <p className="text-sm text-muted-foreground">Log ind for at administrere platformen</p>
          </div>
          <AuthForm />
        </div>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Ingen adgang</CardTitle>
            <CardDescription>
              Din konto har ikke platform_admin-rollen. Kontakt en administrator for at få adgang.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>Log ud</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-semibold">Platform Admin</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Log ud</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <PlatformAdminsCard currentUserId={user.id} />

        <div>
          <h2 className="text-xl font-semibold mb-1">Virksomheder</h2>
          <p className="text-sm text-muted-foreground">
            Overblik over tenants og deres aktive moduler.
          </p>
        </div>

        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : companies.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Ingen virksomheder oprettet endnu.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {companies.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {c.name}
                        {!c.is_active && <Badge variant="secondary">Inaktiv</Badge>}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Slug: <code className="text-xs">{c.slug}</code>
                        {c.custom_domain && (
                          <a
                            href={`https://${c.custom_domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-3 inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {c.custom_domain}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium mb-2">Moduler</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {MODULE_REGISTRY.map((mod) => {
                      const Icon = mod.icon;
                      const enabled = isEnabled(c.id, mod.key);
                      return (
                        <div
                          key={mod.key}
                          className="flex items-center justify-between gap-3 p-3 rounded-md border bg-card"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{mod.label}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {mod.description}
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(v) => toggleModule(c.id, mod.key, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Platform;
