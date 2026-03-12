import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Smartphone, LogOut, Unlink } from "lucide-react";
import { PushSubscriptionButton } from "@/components/PushSubscriptionButton";
import { AbsenceManager } from "@/components/profile/AbsenceManager";
import { profileSchema } from "@/lib/validations";

interface ProfileSettingsProps {
  userId: string;
}

const MicrosoftDisconnect = ({ userId }: { userId: string }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.from("microsoft_tokens").select("id").eq("user_id", userId).maybeSingle()
      .then(({ data }) => setIsConnected(!!data));
  }, [userId]);

  const disconnect = async () => {
    await Promise.all([
      supabase.from("microsoft_tokens").delete().eq("user_id", userId),
      supabase.from("graph_subscriptions").delete().eq("user_id", userId),
    ]);
    setIsConnected(false);
    toast.success("Kalenderforbindelse afbrudt");
  };

  if (!isConnected) return null;

  return (
    <div className="pt-4 border-t">
      <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={disconnect}>
        <Unlink className="w-4 h-4" />
        Afbryd kalenderforbindelse
      </Button>
    </div>
  );
};

export const ProfileSettings = ({ userId }: ProfileSettingsProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [fullName, setFullName] = useState("");
  const [isGlutenFree, setIsGlutenFree] = useState(false);
  const [isLactoseFree, setIsLactoseFree] = useState(false);
  const [isVegetarian, setIsVegetarian] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      toast.error("Kunne ikke indlæse profil");
      return;
    }

    if (data) {
      setFullName(data.full_name || "");
      setIsGlutenFree(data.is_gluten_free);
      setIsLactoseFree(data.is_lactose_free);
      setIsVegetarian(data.is_vegetarian);
    }
    setIsFetching(false);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const validationResult = profileSchema.safeParse({
        fullName,
        isGlutenFree,
        isLactoseFree,
        isVegetarian,
      });

      if (!validationResult.success) {
        toast.error(validationResult.error.errors[0].message);
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: validationResult.data.fullName,
          is_gluten_free: validationResult.data.isGlutenFree,
          is_lactose_free: validationResult.data.isLactoseFree,
          is_vegetarian: validationResult.data.isVegetarian,
        })
        .eq("id", userId);

      if (error) {
        toast.error("Kunne ikke opdatere profil");
      } else {
        toast.success("Profil opdateret med succes!");
      }
    } catch {
      toast.error("Der opstod en fejl under opdatering af profil");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profilindstillinger</CardTitle>
          <CardDescription>Administrer dit navn og dine kostpræferencer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Fulde navn</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dit fulde navn"
            />
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Kostpræferencer</Label>
            <div className="flex items-center space-x-2">
              <Checkbox id="gluten" checked={isGlutenFree} onCheckedChange={(checked) => setIsGlutenFree(checked as boolean)} />
              <Label htmlFor="gluten" className="text-sm font-normal cursor-pointer">Glutenfri</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="lactose" checked={isLactoseFree} onCheckedChange={(checked) => setIsLactoseFree(checked as boolean)} />
              <Label htmlFor="lactose" className="text-sm font-normal cursor-pointer">Laktosefri</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="vegetarian" checked={isVegetarian} onCheckedChange={(checked) => setIsVegetarian(checked as boolean)} />
              <Label htmlFor="vegetarian" className="text-sm font-normal cursor-pointer">Vegetar</Label>
            </div>
          </div>

          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gemmer...</>) : "Gem ændringer"}
          </Button>
        </CardContent>
      </Card>

      {/* Absence Card */}
      <Card>
        <CardHeader>
          <CardTitle>Meld fravær</CardTitle>
          <CardDescription>Registrer ferie, barsel eller andet fravær</CardDescription>
        </CardHeader>
        <CardContent>
          <AbsenceManager userId={userId} />
        </CardContent>
      </Card>

      {/* Functions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Funktioner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PushSubscriptionButton />

          <MicrosoftDisconnect userId={userId} />

          <Button asChild variant="outline" className="w-full">
            <Link to="/install" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Installer appen på telefonen
            </Link>
          </Button>

          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Logget ud");
            }}
          >
            <LogOut className="w-4 h-4" />
            Log ud
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
