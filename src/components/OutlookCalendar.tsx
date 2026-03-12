import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, MapPin, Users, AlertCircle, RefreshCw, Link, Unlink, UtensilsCrossed, ChevronLeft, ChevronRight, Clock, Check, Trash2, Pencil } from "lucide-react";
import { format, parseISO, startOfDay, addDays, startOfWeek, endOfWeek, isSameDay, isWeekend } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { CateringOrderDialog } from "./CateringOrderDialog";

interface CalendarEvent {
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

interface OutlookCalendarProps {
  userEmail: string;
  selectedDate?: Date;
}

export const OutlookCalendar = ({ userEmail, selectedDate }: OutlookCalendarProps) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [cateringEvent, setCateringEvent] = useState<CalendarEvent | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [existingOrders, setExistingOrders] = useState<Record<string, { status: string; id: string; person_count: number; catering_types: string[]; dietary_notes: string | null; comment: string | null; user_id: string; orderer_name: string | null }>>({});
  const [editingOrder, setEditingOrder] = useState<{ event: CalendarEvent; order: { id: string; person_count: number; catering_types: string[]; dietary_notes: string | null; comment: string | null } } | null>(null);
  const [allowedLocations, setAllowedLocations] = useState<string[]>([]);

  // Check if user has connected Microsoft account
  const checkConnection = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("microsoft_tokens")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    setIsConnected(!!data);
  };

  const connectMicrosoft = () => {
    const clientId = "4a478a74-a4dc-4553-8cae-10c9814416b8";
    const tenantId = "1b9fe8e1-0b95-46a2-9574-4e7a39581f22";
    const redirectUri = `${window.location.origin}/microsoft-callback`;

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: "offline_access Calendars.Read",
        response_mode: "query",
        prompt: "select_account",
      }).toString();

    window.location.href = authUrl;
  };

  const disconnectMicrosoft = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Delete tokens and graph subscription
    const [tokenResult] = await Promise.all([
      supabase.from("microsoft_tokens").delete().eq("user_id", user.id),
      supabase.from("graph_subscriptions").delete().eq("user_id", user.id),
    ]);

    if (tokenResult.error) {
      toast.error("Kunne ikke afbryde forbindelsen");
      return;
    }

    setIsConnected(false);
    setEvents([]);
    toast.success("Kalenderforbindelse afbrudt");
  };

  const currentWeekStart = useMemo(() => {
    const base = selectedDate || new Date();
    const weekStart = startOfWeek(addDays(base, weekOffset * 7), { weekStartsOn: 1 });
    return weekStart;
  }, [selectedDate, weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(currentWeekStart, i)); // Mon-Fri
  }, [currentWeekStart]);

  const fetchEvents = async () => {
    if (!isConnected) return;

    setIsLoading(true);
    setError(null);
    setErrorType(null);

    try {
      const startDate = startOfDay(currentWeekStart).toISOString();
      const endDate = startOfDay(addDays(currentWeekStart, 5)).toISOString();

      const { data, error: fnError } = await supabase.functions.invoke(
        "get-calendar-events",
        { body: { startDate, endDate } }
      );

      if (fnError) {
        throw new Error(fnError.message || "Kunne ikke hente kalender");
      }

      if (data?.error) {
        if (data.error === "not_connected" || data.error === "token_expired") {
          setIsConnected(false);
          setEvents([]);
          return;
        }
        setErrorType(data.error);
        setError(data.message);
        setEvents([]);
        return;
      }

      setEvents(data?.events || []);
    } catch (err: any) {
      console.error("Calendar fetch error:", err);
      setError(err.message || "Ukendt fejl");
      setEvents([]);
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
      const orderMap: Record<string, { status: string; id: string; person_count: number; catering_types: string[]; dietary_notes: string | null; comment: string | null; user_id: string; orderer_name: string | null }> = {};
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

  const fetchAllowedLocations = async () => {
    const { data } = await supabase
      .from("company_settings")
      .select("allowed_locations")
      .single();
    if (data) {
      setAllowedLocations((data as any).allowed_locations || []);
    }
  };

  useEffect(() => {
    checkConnection();
    fetchAllowedLocations();
  }, []);

  const autoCancelOrphanedOrders = async (fetchedEvents: CalendarEvent[], orders: Record<string, { status: string; id: string }>) => {
    // Build a set of event keys from current calendar
    const eventKeys = new Set<string>();
    fetchedEvents.forEach((e) => {
      if (e.isAllDay || !e.location) return;
      try {
        const date = format(parseISO(e.startTime), "yyyy-MM-dd");
        const time = `${format(parseISO(e.startTime), "HH:mm")} - ${format(parseISO(e.endTime), "HH:mm")}`;
        eventKeys.add(`${e.subject}|${date}|${time}`);
      } catch { /* ignore parse errors */ }
    });

    // Find pending orders with no matching event
    const orphanedIds: string[] = [];
    for (const [key, order] of Object.entries(orders)) {
      if ((order.status === "pending" || order.status === "confirmed") && !eventKeys.has(key)) {
        orphanedIds.push(order.id);
      }
    }

    if (orphanedIds.length > 0) {
      for (const id of orphanedIds) {
        await supabase.from("catering_orders").update({ status: "cancelled" }).eq("id", id);
      }
      toast.info(`${orphanedIds.length} forplejningsbestilling${orphanedIds.length > 1 ? "er" : ""} annulleret — mødet er fjernet fra din kalender`);
      // Re-fetch orders to update UI
      fetchExistingOrders();
    }
  };

  useEffect(() => {
    if (isConnected) {
      const loadAndCheck = async () => {
        // Fetch events
        setIsLoading(true);
        setError(null);
        setErrorType(null);
        let fetchedEvents: CalendarEvent[] = [];
        try {
          const startDate = startOfDay(currentWeekStart).toISOString();
          const endDate = startOfDay(addDays(currentWeekStart, 5)).toISOString();
          const { data, error: fnError } = await supabase.functions.invoke("get-calendar-events", { body: { startDate, endDate } });
          if (fnError) throw new Error(fnError.message || "Kunne ikke hente kalender");
          if (data?.error) {
            if (data.error === "not_connected" || data.error === "token_expired") {
              setIsConnected(false); setEvents([]); return;
            }
            setErrorType(data.error); setError(data.message); setEvents([]); return;
          }
          fetchedEvents = data?.events || [];
          setEvents(fetchedEvents);
        } catch (err: any) {
          console.error("Calendar fetch error:", err);
          setError(err.message || "Ukendt fejl"); setEvents([]); return;
        } finally {
          setIsLoading(false);
        }

        // Fetch existing orders (shared across all users)
        const weekStart = format(currentWeekStart, "yyyy-MM-dd");
        const weekEnd = format(addDays(currentWeekStart, 5), "yyyy-MM-dd");
        const { data: ordersData } = await supabase
          .from("catering_orders")
          .select("id, meeting_subject, meeting_date, meeting_time, meeting_location, status, person_count, catering_types, dietary_notes, comment, user_id, profiles:user_id(full_name, email)")
          .gte("meeting_date", weekStart)
          .lte("meeting_date", weekEnd)
          .neq("status", "cancelled");

        if (ordersData) {
          const orderMap: Record<string, { status: string; id: string; person_count: number; catering_types: string[]; dietary_notes: string | null; comment: string | null; user_id: string; orderer_name: string | null }> = {};
          ordersData.forEach((o: any) => {
            const key = `${o.meeting_date}|${o.meeting_time}|${(o.meeting_location || "").toLowerCase()}`;
            const profile = o.profiles;
            orderMap[key] = {
              status: o.status, id: o.id, person_count: o.person_count,
              catering_types: o.catering_types, dietary_notes: o.dietary_notes, comment: o.comment,
              user_id: o.user_id,
              orderer_name: profile?.full_name || profile?.email || null,
            };
          });
          setExistingOrders(orderMap);

          // Auto-cancel orphaned orders
          await autoCancelOrphanedOrders(fetchedEvents, orderMap);
        }
      };
      loadAndCheck();
    }
  }, [isConnected, selectedDate, weekOffset]);

  // Realtime subscription for catering_orders status changes
  useEffect(() => {
    const channel = supabase
      .channel("catering_orders_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "catering_orders" },
        () => fetchExistingOrders()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentWeekStart]);

  const formatTime = (dateTimeStr: string) => {
    try {
      return format(parseISO(dateTimeStr), "HH:mm");
    } catch {
      return "";
    }
  };

  const weekLabel = `Uge ${format(currentWeekStart, "w", { locale: da })} — ${format(currentWeekStart, "d. MMM", { locale: da })} – ${format(addDays(currentWeekStart, 4), "d. MMM yyyy", { locale: da })}`;

  const getEventsForDay = (day: Date) => {
    return events
      .filter((e) => !e.isAllDay && e.attendeeCount > 0 && !!e.location)
      .filter((e) => {
        // If allowed locations are configured, only show matching events
        if (allowedLocations.length > 0) {
          const loc = (e.location || "").toLowerCase();
          return allowedLocations.some(al => loc.includes(al.toLowerCase()));
        }
        return true;
      })
      .filter((e) => {
        try {
          return isSameDay(parseISO(e.startTime), day);
        } catch {
          return false;
        }
      });
  };

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Forplejning
          </CardTitle>
          <div className="flex items-center gap-1">
            {isConnected && (
              <Button variant="ghost" size="icon" onClick={fetchEvents} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            )}
            {isConnected && (
              <Button variant="ghost" size="icon" onClick={disconnectMicrosoft} title="Afbryd forbindelse">
                <Unlink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        {isConnected && (
          <div className="flex items-center justify-between mt-1">
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <p className="text-sm text-muted-foreground">{weekLabel}</p>
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isConnected === null ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CalendarDays className="w-10 h-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Forbind din kalender</p>
              <p className="text-xs text-muted-foreground mt-1">
                Se dine møder og bestil forplejning ved at logge ind med din Microsoft-konto
              </p>
            </div>
            <Button onClick={connectMicrosoft} className="gap-2">
              <Link className="w-4 h-4" />
              Forbind kalender
            </Button>
          </div>
        ) : isLoading ? (
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
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Kunne ikke hente kalender</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchEvents}>
              Prøv igen
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
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
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="border rounded-lg p-3 flex flex-col gap-2 bg-card min-h-[120px]"
                        >
                          {/* Top Row: Title and Attendee Count */}
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

                          {/* Metadata Row */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(event.startTime)} - {formatTime(event.endTime)}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{event.location}</span>
                              </span>
                            )}
                          </div>

                          {/* Action Row */}
                          <div className="flex items-center justify-end gap-2 mt-auto">
                            {(() => {
                              const orderKey = `${format(parseISO(event.startTime), "yyyy-MM-dd")}|${formatTime(event.startTime)} - ${formatTime(event.endTime)}|${(event.location || "").toLowerCase()}`;
                              const order = existingOrders[orderKey];
                              if (order) {
                                const statusLabels: Record<string, { label: string; className: string }> = {
                                  pending: { label: "Afventer", className: "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30" },
                                  confirmed: { label: "Bekræftet", className: "text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30" },
                                  delivered: { label: "Leveret", className: "text-muted-foreground border-muted bg-muted/50" },
                                  cancelled: { label: "Annulleret", className: "text-destructive border-destructive/30 bg-destructive/10" },
                                };
                                const info = statusLabels[order.status] || { label: order.status, className: "" };
                                return (
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={`gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 ${info.className}`}>
                                          {order.status === "pending" && <Clock className="w-3 h-3" />}
                                          {order.status === "confirmed" && <Check className="w-3 h-3" />}
                                          {info.label}
                                        </Badge>
                                        {(order.status === "pending" || order.status === "confirmed") && (
                                          <>
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              className="h-8 w-8"
                                              title="Rediger"
                                              onClick={() => setEditingOrder({ event, order })}
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
                                                if (error) {
                                                  toast.error("Kunne ikke annullere bestilling");
                                                } else {
                                                  toast.success("Bestilling annulleret");
                                                  fetchExistingOrders();
                                                }
                                              }}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                      {order.orderer_name && (
                                        <span className="text-[10px] text-muted-foreground">
                                          Bestilt af {order.orderer_name}
                                        </span>
                                      )}
                                    </div>
                                );
                              }
                              return (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Bestil forplejning"
                                  onClick={() => setCateringEvent(event)}
                                >
                                  <UtensilsCrossed className="w-3.5 h-3.5" />
                                </Button>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>

    {cateringEvent && (
      <CateringOrderDialog
        open={!!cateringEvent}
        onOpenChange={(open) => { if (!open) { setCateringEvent(null); fetchExistingOrders(); } }}
        meeting={{
          subject: cateringEvent.subject,
          date: format(parseISO(cateringEvent.startTime), "yyyy-MM-dd"),
          time: `${formatTime(cateringEvent.startTime)} - ${formatTime(cateringEvent.endTime)}`,
          location: cateringEvent.location,
          attendeeCount: cateringEvent.attendeeCount,
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
          location: editingOrder.event.location,
          attendeeCount: editingOrder.event.attendeeCount,
        }}
        existingOrder={editingOrder.order}
      />
    )}
    </>
  );
};
