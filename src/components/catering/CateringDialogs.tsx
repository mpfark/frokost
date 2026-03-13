import { format, parseISO } from "date-fns";
import { CateringOrderDialog } from "../CateringOrderDialog";
import type { CalendarEvent, ExistingOrder } from "./types";

const formatTime = (dateTimeStr: string) => {
  try { return format(parseISO(dateTimeStr), "HH:mm"); } catch { return ""; }
};

interface CateringDialogsProps {
  cateringEvent: CalendarEvent | null;
  editingOrder: { event: CalendarEvent; order: ExistingOrder } | null;
  onCateringClose: () => void;
  onEditClose: () => void;
}

export const CateringDialogs = ({ cateringEvent, editingOrder, onCateringClose, onEditClose }: CateringDialogsProps) => {
  return (
    <>
      {cateringEvent && (
        <CateringOrderDialog
          open={!!cateringEvent}
          onOpenChange={(open) => { if (!open) onCateringClose(); }}
          meeting={{
            subject: cateringEvent.subject,
            date: format(parseISO(cateringEvent.startTime), "yyyy-MM-dd"),
            time: `${formatTime(cateringEvent.startTime)} - ${formatTime(cateringEvent.endTime)}`,
            location: cateringEvent.location,
            attendeeCount: cateringEvent.attendeeCount,
            externalMeetingId: cateringEvent.externalMeetingId,
          }}
        />
      )}

      {editingOrder && (
        <CateringOrderDialog
          open={!!editingOrder}
          onOpenChange={(open) => { if (!open) onEditClose(); }}
          meeting={{
            subject: editingOrder.event.subject,
            date: format(parseISO(editingOrder.event.startTime), "yyyy-MM-dd"),
            time: `${formatTime(editingOrder.event.startTime)} - ${formatTime(editingOrder.event.endTime)}`,
            location: editingOrder.event.location,
            attendeeCount: editingOrder.event.attendeeCount,
            externalMeetingId: editingOrder.event.externalMeetingId,
          }}
          existingOrder={editingOrder.order}
        />
      )}
    </>
  );
};
