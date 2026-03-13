import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, MapPin, UtensilsCrossed, Check, Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CalendarEvent, ExistingOrder } from "./types";
import { buildMeetingOrderKey } from "./orderKey";

const formatTime = (dateTimeStr: string) => {
  try { return format(parseISO(dateTimeStr), "HH:mm"); } catch { return ""; }
};

export const getOrderKey = (event: CalendarEvent) => {
  return buildMeetingOrderKey(
    format(parseISO(event.startTime), "yyyy-MM-dd"),
    `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`,
    event.location,
  );
};

interface EventCardProps {
  event: CalendarEvent;
  order?: ExistingOrder;
  onOrder: (event: CalendarEvent) => void;
  onEdit: (event: CalendarEvent, order: ExistingOrder) => void;
  onOrdersChanged: () => void;
  showLocation?: boolean;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Afventer", className: "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30" },
  confirmed: { label: "Bekræftet", className: "text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30" },
  delivered: { label: "Leveret", className: "text-muted-foreground border-muted bg-muted/50" },
  cancelled: { label: "Annulleret", className: "text-destructive border-destructive/30 bg-destructive/10" },
};

export const EventCard = ({ event, order, onOrder, onEdit, onOrdersChanged, showLocation = true }: EventCardProps) => {
  const handleCancel = async () => {
    if (!order) return;
    const { error } = await supabase
      .from("catering_orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);
    if (error) toast.error("Kunne ikke annullere bestilling");
    else { toast.success("Bestilling annulleret"); onOrdersChanged(); }
  };

  return (
    <div className="border rounded-lg p-3 flex flex-col gap-2 bg-card min-h-[120px]">
      <div className="flex justify-between items-start gap-2">
        <h4 className="text-sm font-semibold leading-tight line-clamp-1" title={event.subject}>
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
        {showLocation && event.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{event.location}</span>
          </span>
        )}
        {!showLocation && event.organizer && (
          <span className="truncate max-w-[140px]" title={event.organizer}>
            {event.organizer}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto">
        {order ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col gap-0.5">
              {(() => {
                const info = STATUS_LABELS[order.status] || { label: order.status, className: "" };
                return (
                  <Badge variant="outline" className={`gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 ${info.className}`}>
                    {order.status === "pending" && <Clock className="w-3 h-3" />}
                    {order.status === "confirmed" && <Check className="w-3 h-3" />}
                    {info.label}
                  </Badge>
                );
              })()}
              {order.orderer_name && (
                <span className="text-[10px] text-muted-foreground">Bestilt af {order.orderer_name}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {(order.status === "pending" || order.status === "confirmed") && (
                <>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    title="Opdatér forplejning"
                    onClick={() => onEdit(event, order)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="text-xs">Opdatér</span>
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Annullér" onClick={handleCancel}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 ml-auto" title="Bestil forplejning" onClick={() => onOrder(event)}>
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span className="text-xs">Bestil</span>
          </Button>
        )}
      </div>
    </div>
  );
};
