import { format, isSameDay, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { EventCard, findOrderForEvent } from "./EventCard";
import type { CalendarEvent, ExistingOrder } from "./types";
import type { ClosedDatesMap } from "./useClosedDates";

interface WeekDayGridProps {
  weekDays: Date[];
  events: CalendarEvent[];
  existingOrders: Record<string, ExistingOrder>;
  onOrder: (event: CalendarEvent) => void;
  onEdit: (event: CalendarEvent, order: ExistingOrder) => void;
  onOrdersChanged: () => void;
  showLocation?: boolean;
  closedDates?: ClosedDatesMap;
}

export const WeekDayGrid = ({ weekDays, events, existingOrders, onOrder, onEdit, onOrdersChanged, showLocation = true, closedDates = {} }: WeekDayGridProps) => {
  const getEventsForDay = (day: Date) => {
    return events.filter((e) => {
      try { return isSameDay(parseISO(e.startTime), day); } catch { return false; }
    });
  };

  return (
    <div className="flex flex-wrap gap-4">
      {weekDays.map((day) => {
        const dayEvents = getEventsForDay(day);
        const isToday = isSameDay(day, new Date());
        const dayKey = format(day, "yyyy-MM-dd");
        const isClosed = Object.prototype.hasOwnProperty.call(closedDates, dayKey);
        const closedReason = isClosed ? closedDates[dayKey] : null;
        return (
          <div key={day.toISOString()} className="min-w-[220px] flex-1">
            <p className={`text-xs font-semibold mb-1 capitalize ${isToday ? "text-primary" : "text-muted-foreground"}`}>
              {format(day, "EEEE d. MMM", { locale: da })}
              {isToday && <span className="ml-1 text-[10px] font-normal">(i dag)</span>}
            </p>
            {isClosed && (
              <p className="text-[11px] text-destructive mb-2 font-medium">
                Køkkenet er lukket{closedReason ? ` (${closedReason})` : ""}
              </p>
            )}
            {dayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-2 pb-2">Ingen møder</p>
            ) : (
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    order={findOrderForEvent(event, existingOrders)}
                    onOrder={onOrder}
                    onEdit={onEdit}
                    onOrdersChanged={onOrdersChanged}
                    showLocation={showLocation}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
