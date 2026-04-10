import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Palette, RotateCcw } from "lucide-react";
import { ColorPicker } from "@/components/shared/ColorPicker";

const DEFAULT_COLORS = {
  primary: "25 95% 37%",
  secondary: "35 40% 90%",
  accent: "20 90% 48%"
};

export const AppearanceSettings = () => {
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_COLORS.primary);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_COLORS.secondary);
  const [accentColor, setAccentColor] = useState(DEFAULT_COLORS.accent);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("primary_color, secondary_color, accent_color")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setPrimaryColor(data.primary_color || DEFAULT_COLORS.primary);
        setSecondaryColor(data.secondary_color || DEFAULT_COLORS.secondary);
        setAccentColor(data.accent_color || DEFAULT_COLORS.accent);
      }
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("company_settings")
          .update({ 
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            accent_color: accentColor
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_settings")
          .insert({ 
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            accent_color: accentColor,
            allowed_domain: ''
          });

        if (error) throw error;
      }

      toast({
        title: "Succes",
        description: "Farvetema gemt",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setPrimaryColor(DEFAULT_COLORS.primary);
    setSecondaryColor(DEFAULT_COLORS.secondary);
    setAccentColor(DEFAULT_COLORS.accent);
    toast({
      title: "Farver nulstillet",
      description: "Farverne er sat tilbage til standard. Husk at gemme ændringerne.",
    });
  };

  if (isFetching) {
    return <div>Indlæser...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Farvetema
        </CardTitle>
        <CardDescription>
          Tilpas farverne på hjemmesiden
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <ColorPicker
            label="Primær farve"
            value={primaryColor}
            onChange={setPrimaryColor}
            disabled={isLoading}
          />
          <ColorPicker
            label="Sekundær farve"
            value={secondaryColor}
            onChange={setSecondaryColor}
            disabled={isLoading}
          />
          <ColorPicker
            label="Accent farve"
            value={accentColor}
            onChange={setAccentColor}
            disabled={isLoading}
          />
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Forhåndsvisning</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div 
                className="h-16 rounded-md border"
                style={{ backgroundColor: `hsl(${primaryColor})` }}
              />
              <p className="text-xs text-center text-muted-foreground">Primær</p>
            </div>
            <div className="space-y-2">
              <div 
                className="h-16 rounded-md border"
                style={{ backgroundColor: `hsl(${secondaryColor})` }}
              />
              <p className="text-xs text-center text-muted-foreground">Sekundær</p>
            </div>
            <div className="space-y-2">
              <div 
                className="h-16 rounded-md border"
                style={{ backgroundColor: `hsl(${accentColor})` }}
              />
              <p className="text-xs text-center text-muted-foreground">Accent</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleReset} 
            variant="outline"
            disabled={isLoading}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Nulstil
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Gemmer..." : "Gem farver"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
