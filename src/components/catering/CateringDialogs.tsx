import { format, parseISO } from "date-fns";
import { CateringOrderDialog } from "./CateringOrderDialog";
import type { CalendarEvent, ExistingOrder } from "./types";
import type { ClosedDatesMap } from "./useClosedDates";

const formatTime = (dateTimeStr: string) => {
  try { return format(parseISO(dateTimeStr), "HH:mm"); } catch { return ""; }
};

interface CateringDialogsProps {
  cateringEvent: CalendarEvent | null;
  editingOrder: { event: CalendarEvent; order: ExistingOrder } | null;
  onCateringClose: () => void;
  onEditClose: () => void;
  closedDates?: ClosedDatesMap;
}

export const CateringDialogs = ({ cateringEvent, editingOrder, onCateringClose, onEditClose, closedDates = {} }: CateringDialogsProps) => {
  const closedInfo = (event: CalendarEvent) => {
    const dateKey = format(parseISO(event.startTime), "yyyy-MM-dd");
    if (!Object.prototype.hasOwnProperty.call(closedDates, dateKey)) return null;
    return { reason: closedDates[dateKey] };
  };

  return (
    <>
      {cateringEvent && (
        <CateringOrderDialog
          open={!!cateringEvent}
          onOpenChange={(open) => { if (!open) onCateringClose(); }}
          closedInfo={closedInfo(cateringEvent)}
          meeting={{
            subject: cateringEvent.subject,
            date: format(parseISO(cateringEvent.startTime), "yyyy-MM-dd"),
            time: `${formatTime(cateringEvent.startTime)} - ${formatTime(cateringEvent.endTime)}`,
            location: cateringEvent.location,
            attendeeCount: cateringEvent.attendeeCount,
            attendeeEmails: cateringEvent.attendeeEmails,
            externalMeetingId: cateringEvent.externalMeetingId,
          }}
        />
      )}

      {editingOrder && (
        <CateringOrderDialog
          open={!!editingOrder}
          onOpenChange={(open) => { if (!open) onEditClose(); }}
          closedInfo={closedInfo(editingOrder.event)}
          meeting={{
            subject: editingOrder.event.subject,
            date: format(parseISO(editingOrder.event.startTime), "yyyy-MM-dd"),
            time: `${formatTime(editingOrder.event.startTime)} - ${formatTime(editingOrder.event.endTime)}`,
            location: editingOrder.event.location,
            attendeeCount: editingOrder.event.attendeeCount,
            attendeeEmails: editingOrder.event.attendeeEmails,
            externalMeetingId: editingOrder.event.externalMeetingId,
          }}
          existingOrder={editingOrder.order}
        />
      )}
    </>
  );
};
