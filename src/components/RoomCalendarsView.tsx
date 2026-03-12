import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, Clock, MapPin, Users, UtensilsCrossed, Check, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, startOfDay, addDays, startOfWeek, isSameDay } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { CateringOrderDialog } from "./CateringOrderDialog";

interface RoomEvent {
  id: string;
  subject: string;
  startTime: string;
  startTimezone: string;
  endTime: string;
  endTimezone: string;
  location: string | null;
  isAllDay: boolean;
  organizer: string | null;
  attendeeCount: number;
}

interface RoomResult {
  roomEmail: string;
  events: RoomEvent[];
  error: string | null;
}

interface ExistingOrder {
  status: string;
  id: string;
  person_count: number;
  catering_types: string[];
  dietary_notes: string | null;
  comment: string | null;
  user_id: string;
  orderer_name: string | null;
}

export const RoomCalendarsView = () => {
  const [roomResults, setRoomResults] = useState<RoomResult[]>([]);
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [existingOrders, setExistingOrders] = useState<Record<string, ExistingOrder>>({});
  const [cateringEvent, setCateringEvent] = useState<{ event: RoomEvent; roomName: string } | null>(null);
  const [editingOrder, setEditingOrder] = useState<{ event: RoomEvent; roomName: string; order: ExistingOrder } | null>(null);

  const currentWeekStart = useMemo(() => {
    return startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const weekLabel = `Uge ${format(currentWeekStart, "w", { locale: da })} — ${format(currentWeekStart, "d. MMM", { locale: da })} – ${format(addDays(currentWeekStart, 4), "d. MMM yyyy", { locale: da })}`;

  const fetchRoomCalendars = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get selected room emails from company_settings
      const { data: settings } = await supabase
        .from("company_settings")
        .select("resource_room_emails")
        .single();

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

      // Build room name map from emails (use part before @, or full email)
      const names: Record<string, string> = {};
      roomEmails.forEach((email: string) => {
        // Try to extract a readable name from the email
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

  const fetchExistingOrders = async () => {
    const weekStart = format(currentWeekStart, "yyyy-MM-dd");
    const weekEnd = format(addDays(currentWeekStart, 5), "yyyy-MM-dd");

    const { data } = await supabase
      .from("catering_orders")
      .select("id, meeting_subject, meeting_date, meeting_time, meeting_location, status, person_count, catering_types, dietary_notes, comment, user_id, profiles:user_id(full_name, email)")
      .gte("meeting_date", weekStart)
      .lte("meeting_date", weekEnd)
      .neq("status", "cancelled");

    if (data) {
      const orderMap: Record<string, ExistingOrder> = {};
      data.forEach((o: any) => {
        const key = `${o.meeting_date}|${o.meeting_time}|${(o.meeting_location || "").toLowerCase()}`;
        const profile = o.profiles;
        orderMap[key] = {
          status: o.status,
          id: o.id,
          person_count: o.person_count,
          catering_types: o.catering_types,
          dietary_notes: o.dietary_notes,
          comment: o.comment,
          user_id: o.user_id,
          orderer_name: profile?.full_name || profile?.email || null,
        };
      });
      setExistingOrders(orderMap);
    }
  };

  useEffect(() => {
    fetchRoomCalendars();
    fetchExistingOrders();
  }, [weekOffset]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("room_catering_orders_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "catering_orders" }, () => fetchExistingOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentWeekStart]);

  const formatTime = (dateTimeStr: string) => {
    try { return format(parseISO(dateTimeStr), "HH:mm"); } catch { return ""; }
  };

  const getEventsForDay = (events: RoomEvent[], day: Date) => {
    return events
      .filter((e) => !e.isAllDay)
      .filter((e) => {
        try { return isSameDay(parseISO(e.startTime), day); } catch { return false; }
      });
  };

  const renderEventCard = (event: RoomEvent, roomName: string) => {
    const orderKey = `${format(parseISO(event.startTime), "yyyy-MM-dd")}|${formatTime(event.startTime)} - ${formatTime(event.endTime)}|${(event.location || roomName || "").toLowerCase()}`;
    const order = existingOrders[orderKey];

    return (
      <div key={event.id} className="border rounded-lg p-3 flex flex-col gap-2 bg-card min-h-[120px]">
        <div className="flex justify-between items-start gap-2">
          <h4 className="text-sm font-semibold leading-tight line-clamp-2" title={event.subject}>
            {event.subject}
          </h4>
          {event.attendeeCount > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium shrink-0">
              <Users className="w-3 h-3" />
              <span>{event.attendeeCount}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(event.startTime)} - {formatTime(event.endTime)}
          </span>
          {event.organizer && (
            <span className="truncate max-w-[140px]" title={event.organizer}>
              {event.organizer}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-auto">
          {order ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                {(() => {
                  const statusLabels: Record<string, { label: string; className: string }> = {
                    pending: { label: "Afventer", className: "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30" },
                    confirmed: { label: "Bekræftet", className: "text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30" },
                    delivered: { label: "Leveret", className: "text-muted-foreground border-muted bg-muted/50" },
                    cancelled: { label: "Annulleret", className: "text-destructive border-destructive/30 bg-destructive/10" },
                  };
                  const info = statusLabels[order.status] || { label: order.status, className: "" };
                  return (
                    <Badge variant="outline" className={`gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 ${info.className}`}>
                      {order.status === "pending" && <Clock className="w-3 h-3" />}
                      {order.status === "confirmed" && <Check className="w-3 h-3" />}
                      {info.label}
                    </Badge>
                  );
                })()}
                {(order.status === "pending" || order.status === "confirmed") && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      title="Rediger"
                      onClick={() => setEditingOrder({ event, roomName, order })}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Annullér"
                      onClick={async () => {
                        const { error } = await supabase
                          .from("catering_orders")
                          .update({ status: "cancelled" })
                          .eq("id", order.id);
                        if (error) toast.error("Kunne ikke annullere bestilling");
                        else { toast.success("Bestilling annulleret"); fetchExistingOrders(); }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
              {order.orderer_name && (
                <span className="text-[10px] text-muted-foreground">Bestilt af {order.orderer_name}</span>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Bestil forplejning"
              onClick={() => setCateringEvent({ event, roomName })}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

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
          {roomResults.map((room) => (
            <div key={room.roomEmail}>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                {roomNames[room.roomEmail] || room.roomEmail}
              </h3>
              {room.error ? (
                <p className="text-xs text-destructive pl-6">{room.error}</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {weekDays.map((day) => {
                    const dayEvents = getEventsForDay(room.events, day);
                    const isToday = isSameDay(day, new Date());
                    const roomDisplayName = roomNames[room.roomEmail] || room.roomEmail;
                    return (
                      <div key={day.toISOString()} className="min-w-[220px] flex-1">
                        <p className={`text-xs font-semibold mb-2 capitalize ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                          {format(day, "EEEE d. MMM", { locale: da })}
                          {isToday && <span className="ml-1 text-[10px] font-normal">(i dag)</span>}
                        </p>
                        {dayEvents.length === 0 ? (
                          <p className="text-xs text-muted-foreground pl-2 pb-2">Ingen møder</p>
                        ) : (
                          <div className="space-y-2">
                            {dayEvents.map((event) => renderEventCard(
                              { ...event, location: event.location || roomDisplayName },
                              roomDisplayName
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {cateringEvent && (
        <CateringOrderDialog
          open={!!cateringEvent}
          onOpenChange={(open) => { if (!open) { setCateringEvent(null); fetchExistingOrders(); } }}
          meeting={{
            subject: cateringEvent.event.subject,
            date: format(parseISO(cateringEvent.event.startTime), "yyyy-MM-dd"),
            time: `${formatTime(cateringEvent.event.startTime)} - ${formatTime(cateringEvent.event.endTime)}`,
            location: cateringEvent.event.location || cateringEvent.roomName,
            attendeeCount: cateringEvent.event.attendeeCount,
          }}
        />
      )}

      {editingOrder && (
        <CateringOrderDialog
          open={!!editingOrder}
          onOpenChange={(open) => { if (!open) { setEditingOrder(null); fetchExistingOrders(); } }}
          meeting={{
            subject: editingOrder.event.subject,
            date: format(parseISO(editingOrder.event.startTime), "yyyy-MM-dd"),
            time: `${formatTime(editingOrder.event.startTime)} - ${formatTime(editingOrder.event.endTime)}`,
            location: editingOrder.event.location || editingOrder.roomName,
            attendeeCount: editingOrder.event.attendeeCount,
          }}
          existingOrder={editingOrder.order}
        />
      )}
    </>
  );
};
