import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { startOfDay, addDays, isSameDay, parseISO } from "date-fns";
import { WeekDayGrid } from "./catering/WeekDayGrid";
import { CateringDialogs } from "./catering/CateringDialogs";
import { useWeekNavigation } from "./catering/useWeekNavigation";
import { useCateringOrders } from "./catering/useCateringOrders";
import type { CalendarEvent, ExistingOrder } from "./catering/types";

interface RoomResult {
  roomEmail: string;
  events: CalendarEvent[];
  error: string | null;
}

export const RoomCalendarsView = () => {
  const [roomResults, setRoomResults] = useState<RoomResult[]>([]);
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cateringEvent, setCateringEvent] = useState<CalendarEvent | null>(null);
  const [editingOrder, setEditingOrder] = useState<{ event: CalendarEvent; order: ExistingOrder } | null>(null);

  const { weekOffset, setWeekOffset, currentWeekStart, weekDays, weekLabel } = useWeekNavigation();
  const { existingOrders, fetchExistingOrders } = useCateringOrders(currentWeekStart);

  const fetchRoomCalendars = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: settings } = await supabase.from("company_settings").select("resource_room_emails").single();
      const roomEmails: string[] = (settings as any)?.resource_room_emails || [];
      if (roomEmails.length === 0) {
        setError("Ingen mødelokaler er konfigureret. Bed en administrator om at vælge lokaler under Indstillinger.");
        setRoomResults([]);
        return;
      }

      const startDate = startOfDay(currentWeekStart).toISOString();
      const endDate = startOfDay(addDays(currentWeekStart, 5)).toISOString();
      const { data, error: fnError } = await supabase.functions.invoke("get-room-calendars", {
        body: { startDate, endDate, roomEmails },
      });
      if (fnError) throw new Error(fnError.message || "Kunne ikke hente lokalekalendere");
      if (data?.error) throw new Error(data.message || data.error);

      setRoomResults(data?.rooms || []);

      const names: Record<string, string> = {};
      roomEmails.forEach((email: string) => {
        const localPart = email.split("@")[0];
        names[email] = localPart.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      });
      setRoomNames(names);
    } catch (err: any) {
      console.error("Room calendar fetch error:", err);
      setError(err.message || "Ukendt fejl");
      setRoomResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomCalendars();
    fetchExistingOrders();
  }, [weekOffset]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-12 w-16 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Kunne ikke hente lokalekalendere</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRoomCalendars}>Prøv igen</Button>
      </div>
    );
  }

  return (
    <>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <p className="text-sm text-muted-foreground">{weekLabel}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchRoomCalendars} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {roomResults.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Ingen mødelokaler fundet</p>
      ) : (
        <div className="space-y-6">
          {roomResults.map((room) => {
            const roomDisplayName = roomNames[room.roomEmail] || room.roomEmail;
            // Enrich events with room name as location if missing
            const enrichedEvents = room.events
              .filter((e) => !e.isAllDay)
              .map((e) => ({ ...e, location: e.location || roomDisplayName }));

            return (
              <div key={room.roomEmail}>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  {roomDisplayName}
                </h3>
                {room.error ? (
                  <p className="text-xs text-destructive pl-6">{room.error}</p>
                ) : (
                  <WeekDayGrid
                    weekDays={weekDays}
                    events={enrichedEvents}
                    existingOrders={existingOrders}
                    onOrder={(e) => setCateringEvent(e)}
                    onEdit={(e, o) => setEditingOrder({ event: e, order: o })}
                    onOrdersChanged={fetchExistingOrders}
                    showLocation={false}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <CateringDialogs
        cateringEvent={cateringEvent}
        editingOrder={editingOrder}
        onCateringClose={() => { setCateringEvent(null); fetchExistingOrders(); }}
        onEditClose={() => { setEditingOrder(null); fetchExistingOrders(); }}
      />
    </>
  );
};
