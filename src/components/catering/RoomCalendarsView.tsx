import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { startOfDay, addDays, format } from "date-fns";
import { WeekDayGrid } from "./WeekDayGrid";
import { CateringDialogs } from "./CateringDialogs";
import { useWeekNavigation } from "./useWeekNavigation";
import { useCateringOrders } from "./useCateringOrders";
import type { CalendarEvent, ExistingOrder } from "./types";

interface RoomResult {
  roomEmail: string;
  displayName?: string | null;
  events: CalendarEvent[];
  error: string | null;
}

export interface RoomCalendarsViewRef {
  refresh: () => void;
}

export const RoomCalendarsView = forwardRef<RoomCalendarsViewRef>((_, ref) => {
  const [roomResults, setRoomResults] = useState<RoomResult[]>([]);
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
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

      const rooms: RoomResult[] = data?.rooms || [];
      setRoomResults(rooms);

      const names: Record<string, string> = {};
      rooms.forEach((room: RoomResult) => {
        if (room.displayName) {
          names[room.roomEmail] = room.displayName;
        } else {
          const localPart = room.roomEmail.split("@")[0];
          names[room.roomEmail] = localPart.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        }
      });
      setRoomNames(names);
      // Set first room as active if none selected
      if (!activeRoom && rooms.length > 0) {
        setActiveRoom(rooms[0].roomEmail);
      }
    } catch (err: any) {
      console.error("Room calendar fetch error:", err);
      setError(err.message || "Ukendt fejl");
      setRoomResults([]);
    } finally {
      setIsLoading(false);
    }

    // The server verifies organizer events independently of who ordered.
    try {
      const { data: recon, error: reconError } = await supabase.functions.invoke("reconcile-room-bookings", { body: { weekStart: format(currentWeekStart, "yyyy-MM-dd"), daysAhead: 7 } });
      if (reconError) throw reconError;
      if (recon && typeof recon === "object" && ((recon as any).cancelled > 0 || (recon as any).updated > 0)) {
        fetchExistingOrders();
      }
    } catch (e) {
      console.warn("reconcile-room-bookings failed:", e);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: fetchRoomCalendars,
  }));

  useEffect(() => {
    fetchRoomCalendars();
    fetchExistingOrders();
  }, [weekOffset]);

  RoomCalendarsView.displayName = "RoomCalendarsView";

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
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {roomResults.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Ingen mødelokaler fundet</p>
      ) : (
        <Tabs value={activeRoom || roomResults[0]?.roomEmail} onValueChange={setActiveRoom}>
          <TabsList className="w-full mb-3 flex-wrap h-auto gap-1">
            {roomResults.map((room) => (
              <TabsTrigger key={room.roomEmail} value={room.roomEmail} className="flex-1 text-xs">
                {roomNames[room.roomEmail] || room.roomEmail}
              </TabsTrigger>
            ))}
          </TabsList>

          {roomResults.map((room) => {
            const roomDisplayName = roomNames[room.roomEmail] || room.roomEmail;
            const enrichedEvents = room.events
              .filter((e) => !e.isAllDay)
              .map((e) => ({ ...e, location: e.location || roomDisplayName }));

            return (
              <TabsContent key={room.roomEmail} value={room.roomEmail} className="mt-0">
                {room.error ? (
                  <p className="text-xs text-destructive">{room.error}</p>
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
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <CateringDialogs
        cateringEvent={cateringEvent}
        editingOrder={editingOrder}
        onCateringClose={() => { setCateringEvent(null); fetchExistingOrders(); }}
        onEditClose={() => { setEditingOrder(null); fetchExistingOrders(); }}
      />
    </>
  );
});

RoomCalendarsView.displayName = "RoomCalendarsView";
