import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, AlertCircle, RefreshCw, Link, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, startOfDay, addDays, isSameDay } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoomCalendarsView, type RoomCalendarsViewRef } from "./RoomCalendarsView";
import { WeekDayGrid } from "./catering/WeekDayGrid";
import { CateringDialogs } from "./catering/CateringDialogs";
import { useWeekNavigation } from "./catering/useWeekNavigation";
import { useCateringOrders } from "./catering/useCateringOrders";
import type { CalendarEvent, ExistingOrder } from "./catering/types";

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
  const [activeSubTab, setActiveSubTab] = useState("my-meetings");
  const [allowedLocations, setAllowedLocations] = useState<string[]>([]);
  const [cateringEvent, setCateringEvent] = useState<CalendarEvent | null>(null);
  const [editingOrder, setEditingOrder] = useState<{ event: CalendarEvent; order: ExistingOrder } | null>(null);
  const roomCalendarsRef = useRef<RoomCalendarsViewRef>(null);

  const { weekOffset, setWeekOffset, currentWeekStart, weekDays, weekLabel } = useWeekNavigation(selectedDate);
  const { existingOrders, fetchExistingOrders } = useCateringOrders(currentWeekStart);

  const checkConnection = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("microsoft_tokens").select("id").eq("user_id", user.id).maybeSingle();
    setIsConnected(!!data);
  };

  const connectMicrosoft = () => {
    const clientId = "4a478a74-a4dc-4553-8cae-10c9814416b8";
    const tenantId = "1b9fe8e1-0b95-46a2-9574-4e7a39581f22";
    const redirectUri = `${window.location.origin}/microsoft-callback`;
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      new URLSearchParams({
        client_id: clientId, response_type: "code", redirect_uri: redirectUri,
        scope: "offline_access Calendars.Read", response_mode: "query", prompt: "select_account",
      }).toString();
    window.location.href = authUrl;
  };

  const disconnectMicrosoft = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [tokenResult] = await Promise.all([
      supabase.from("microsoft_tokens").delete().eq("user_id", user.id),
      supabase.from("graph_subscriptions").delete().eq("user_id", user.id),
    ]);
    if (tokenResult.error) { toast.error("Kunne ikke afbryde forbindelsen"); return; }
    setIsConnected(false);
    setEvents([]);
    toast.success("Kalenderforbindelse afbrudt");
  };

  const fetchEvents = async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    setErrorType(null);
    try {
      const startDate = startOfDay(currentWeekStart).toISOString();
      const endDate = startOfDay(addDays(currentWeekStart, 5)).toISOString();
      const { data, error: fnError } = await supabase.functions.invoke("get-calendar-events", { body: { startDate, endDate } });
      if (fnError) throw new Error(fnError.message || "Kunne ikke hente kalender");
      if (data?.error) {
        if (data.error === "not_connected" || data.error === "token_expired") { setIsConnected(false); setEvents([]); return; }
        setErrorType(data.error); setError(data.message); setEvents([]); return;
      }
      setEvents(data?.events || []);
    } catch (err: any) {
      console.error("Calendar fetch error:", err);
      setError(err.message || "Ukendt fejl"); setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllowedLocations = async () => {
    const { data } = await supabase.from("company_settings").select("allowed_locations").single();
    if (data) setAllowedLocations((data as any).allowed_locations || []);
  };

  const autoCancelOrphanedOrders = async (fetchedEvents: CalendarEvent[], orders: Record<string, ExistingOrder>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const eventKeys = new Set<string>();
    fetchedEvents.forEach((e) => {
      if (e.isAllDay || !e.location) return;
      try {
        const date = format(parseISO(e.startTime), "yyyy-MM-dd");
        const time = `${format(parseISO(e.startTime), "HH:mm")} - ${format(parseISO(e.endTime), "HH:mm")}`;
        eventKeys.add(`${date}|${time}|${(e.location || "").toLowerCase()}`);
      } catch { /* ignore */ }
    });
    const orphanedIds: string[] = [];
    for (const [key, order] of Object.entries(orders)) {
      // Only auto-cancel orders created by the current user
      if (order.user_id === user.id && (order.status === "pending" || order.status === "confirmed") && !eventKeys.has(key)) {
        orphanedIds.push(order.id);
      }
    }
    if (orphanedIds.length > 0) {
      for (const id of orphanedIds) await supabase.from("catering_orders").update({ status: "cancelled" }).eq("id", id);
      toast.info(`${orphanedIds.length} forplejningsbestilling${orphanedIds.length > 1 ? "er" : ""} annulleret — mødet er fjernet fra din kalender`);
      fetchExistingOrders();
    }
  };

  useEffect(() => { checkConnection(); fetchAllowedLocations(); }, []);

  useEffect(() => {
    if (isConnected && activeSubTab === "my-meetings") {
      const loadAndCheck = async () => {
        setIsLoading(true); setError(null); setErrorType(null);
        let fetchedEvents: CalendarEvent[] = [];
        try {
          const startDate = startOfDay(currentWeekStart).toISOString();
          const endDate = startOfDay(addDays(currentWeekStart, 5)).toISOString();
          const { data, error: fnError } = await supabase.functions.invoke("get-calendar-events", { body: { startDate, endDate } });
          if (fnError) throw new Error(fnError.message || "Kunne ikke hente kalender");
          if (data?.error) {
            if (data.error === "not_connected" || data.error === "token_expired") { setIsConnected(false); setEvents([]); return; }
            setErrorType(data.error); setError(data.message); setEvents([]); return;
          }
          fetchedEvents = data?.events || [];
          setEvents(fetchedEvents);
        } catch (err: any) {
          console.error("Calendar fetch error:", err); setError(err.message || "Ukendt fejl"); setEvents([]); return;
        } finally { setIsLoading(false); }
        await fetchExistingOrders();
        await autoCancelOrphanedOrders(fetchedEvents, existingOrders);
      };
      loadAndCheck();
    }
  }, [isConnected, selectedDate, weekOffset, activeSubTab]);

  // Filter events for "my meetings" view
  const filteredEvents = events
    .filter((e) => !e.isAllDay && e.attendeeCount > 0 && !!e.location)
    .filter((e) => {
      if (allowedLocations.length > 0) {
        const loc = (e.location || "").toLowerCase();
        return allowedLocations.some(al => loc.includes(al.toLowerCase()));
      }
      return true;
    });

  return (
    <>
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Forplejning
              </CardTitle>
              <div className="flex items-center gap-1">
                {activeSubTab === "my-meetings" && isConnected && (
                  <Button variant="ghost" size="icon" onClick={fetchEvents} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                  </Button>
                )}
                {activeSubTab === "rooms" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => roomCalendarsRef.current?.refresh()}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <TabsList className="w-full mt-2">
              <TabsTrigger value="my-meetings" className="flex-1">Dine møder</TabsTrigger>
              <TabsTrigger value="rooms" className="flex-1">Mødelokaler</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            <TabsContent value="my-meetings" className="mt-0">
              {/* Week navigation for personal calendar */}
              {isConnected && (
                <div className="flex items-center justify-between mb-3">
                  <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <p className="text-sm text-muted-foreground">{weekLabel}</p>
                  <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {isConnected === null ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
                </div>
              ) : !isConnected ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CalendarDays className="w-10 h-10 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Forbind din kalender</p>
                    <p className="text-xs text-muted-foreground mt-1">Se dine møder og bestil forplejning ved at logge ind med din Microsoft-konto</p>
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
                  <Button variant="outline" size="sm" onClick={fetchEvents}>Prøv igen</Button>
                </div>
              ) : (
                <WeekDayGrid
                  weekDays={weekDays}
                  events={filteredEvents}
                  existingOrders={existingOrders}
                  onOrder={(e) => setCateringEvent(e)}
                  onEdit={(e, o) => setEditingOrder({ event: e, order: o })}
                  onOrdersChanged={fetchExistingOrders}
                  showLocation={true}
                />
              )}
            </TabsContent>

            <TabsContent value="rooms" className="mt-0">
              <RoomCalendarsView ref={roomCalendarsRef} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      <CateringDialogs
        cateringEvent={cateringEvent}
        editingOrder={editingOrder}
        onCateringClose={() => { setCateringEvent(null); fetchExistingOrders(); }}
        onEditClose={() => { setEditingOrder(null); fetchExistingOrders(); }}
      />
    </>
  );
};
