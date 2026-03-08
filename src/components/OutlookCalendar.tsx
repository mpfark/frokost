import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Clock, MapPin, Users, AlertCircle, RefreshCw } from "lucide-react";
import { format, parseISO, startOfDay, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

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
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    setErrorType(null);

    try {
      const date = selectedDate || new Date();
      const startDate = startOfDay(date).toISOString();
      const endDate = startOfDay(addDays(date, 1)).toISOString();

      const { data, error: fnError } = await supabase.functions.invoke(
        "get-calendar-events",
        {
          body: {
            email: userEmail,
            startDate,
            endDate,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message || "Kunne ikke hente kalender");
      }

      if (data?.error) {
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

  useEffect(() => {
    if (userEmail) {
      fetchEvents();
    }
  }, [userEmail, selectedDate]);

  const formatTime = (dateTimeStr: string) => {
    try {
      const date = parseISO(dateTimeStr);
      return format(date, "HH:mm");
    } catch {
      return "";
    }
  };

  const displayDate = selectedDate || new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Outlook Kalender
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchEvents}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(displayDate, "EEEE d. MMMM yyyy", { locale: da })}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
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
              <p className="text-sm font-medium text-foreground">
                {errorType === "calendar_permission_denied"
                  ? "Kalenderadgang afventer godkendelse"
                  : "Kunne ikke hente kalender"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
            {errorType !== "calendar_permission_denied" && (
              <Button variant="outline" size="sm" onClick={fetchEvents}>
                Prøv igen
              </Button>
            )}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CalendarDays className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ingen møder denne dag
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events
              .filter((e) => !e.isAllDay)
              .map((event) => (
                <div
                  key={event.id}
                  className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center min-w-[3.5rem] px-2 py-1 rounded bg-primary/10 text-primary">
                    <span className="text-xs font-medium">
                      {formatTime(event.startTime)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(event.endTime)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {event.subject}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {event.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                      {event.attendeeCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          {event.attendeeCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

            {/* All-day events at the bottom */}
            {events.filter((e) => e.isAllDay).length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Heldagsbegivenheder
                </p>
                {events
                  .filter((e) => e.isAllDay)
                  .map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <Badge variant="secondary" className="text-xs">
                        Heldag
                      </Badge>
                      <span className="text-sm truncate">{event.subject}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
