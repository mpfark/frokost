import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Building2, RefreshCw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MeetingRoom {
  id: string;
  displayName: string;
  emailAddress: string;
  capacity: number | null;
  building: string | null;
  floorNumber: number | null;
  floorLabel: string | null;
}

interface MeetingRoomSelectorProps {
  selectedEmails: string[];
  onSelectionChange: (emails: string[]) => void;
  disabled?: boolean;
}

export const MeetingRoomSelector = ({
  selectedEmails,
  onSelectionChange,
  disabled = false,
}: MeetingRoomSelectorProps) => {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchRooms = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-meeting-rooms");

      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);

      setRooms(data.rooms || []);
      setHasFetched(true);

      if ((data.rooms || []).length === 0) {
        toast({
          title: "Ingen mødelokaler fundet",
          description: "Der blev ikke fundet nogen mødelokaler i jeres Microsoft-organisation.",
        });
      }
    } catch (error: any) {
      console.error("Error fetching rooms:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke hente mødelokaler fra Microsoft. Tjek at Application permissions er korrekt konfigureret.",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  // Auto-fetch rooms on mount if there are selected emails to show names
  useEffect(() => {
    if (selectedEmails.length > 0 && !hasFetched) {
      fetchRooms();
    }
  }, []);

  const toggleRoom = (email: string) => {
    if (selectedEmails.includes(email)) {
      onSelectionChange(selectedEmails.filter((e) => e !== email));
    } else {
      onSelectionChange([...selectedEmails, email]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Mødelokale-kalendere
        </CardTitle>
        <CardDescription>
          Hent mødelokaler automatisk fra Microsoft og vælg hvilke der skal overvåges
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          onClick={fetchRooms}
          disabled={isFetching || disabled}
          className="w-full"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {hasFetched ? "Opdater liste" : "Hent mødelokaler fra Microsoft"}
        </Button>

        {hasFetched && rooms.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Ingen mødelokaler fundet. Kontrollér at <code>Place.Read.All</code> er godkendt i Azure.
          </p>
        )}

        {rooms.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {rooms.map((room) => (
              <label
                key={room.id}
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedEmails.includes(room.emailAddress)}
                  onCheckedChange={() => toggleRoom(room.emailAddress)}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{room.displayName}</span>
                    {room.capacity && (
                      <Badge variant="secondary" className="text-xs">
                        {room.capacity} pers.
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {room.emailAddress}
                  </p>
                  {(room.building || room.floorLabel) && (
                    <p className="text-xs text-muted-foreground">
                      {[room.building, room.floorLabel].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {selectedEmails.length > 0 && !hasFetched && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {selectedEmails.length} mødelokale{selectedEmails.length !== 1 ? "r" : ""} valgt
              {isFetching ? " — henter navne..." : ":"}
            </p>
            {!isFetching && (
              <div className="flex flex-wrap gap-1">
                {selectedEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="text-xs">
                    {email}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
