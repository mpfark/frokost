import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed, Clock, MapPin, Users, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CateringOrder {
  id: string;
  user_id: string;
  meeting_subject: string;
  meeting_date: string;
  meeting_time: string;
  meeting_location: string | null;
  person_count: number;
  catering_types: string[];
  comment: string | null;
  status: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
}

const CATERING_TYPE_LABELS: Record<string, string> = {
  coffee_tea: "Kaffe og te",
  water: "Vand",
  fruit: "Frugt",
  pastry: "Morgenbrød",
  cake: "Kage",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Afventer", variant: "secondary" },
  confirmed: { label: "Bekræftet", variant: "default" },
  delivered: { label: "Leveret", variant: "outline" },
  cancelled: { label: "Annulleret", variant: "destructive" },
};

interface CateringOrdersSectionProps {
  orders: CateringOrder[];
  compact?: boolean;
  onStatusChange?: () => void;
}

export const CateringOrdersSection = ({ orders, compact = false, onStatusChange }: CateringOrdersSectionProps) => {
  if (orders.length === 0) return null;

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("catering_orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast.error("Kunne ikke opdatere status");
      return;
    }

    toast.success(`Status opdateret til ${STATUS_LABELS[newStatus]?.label || newStatus}`);
    onStatusChange?.();
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <UtensilsCrossed className="w-3 h-3" />
        {orders.length} bestilling{orders.length > 1 ? "er" : ""}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <UtensilsCrossed className="w-4 h-4" />
        Forplejningsbestillinger ({orders.length})
      </h4>
      <div className="space-y-2">
        {orders.map((order) => {
          const statusInfo = STATUS_LABELS[order.status] || { label: order.status, variant: "secondary" as const };
          return (
            <div key={order.id} className="p-3 border rounded-lg bg-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{order.meeting_subject}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {order.meeting_time}
                    </span>
                    {order.meeting_location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {order.meeting_location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {order.person_count} pers.
                    </span>
                  </div>
                  {order.profiles && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Bestilt af: {order.profiles.full_name || order.profiles.email}
                    </div>
                  )}
                </div>
                <Badge variant={statusInfo.variant} className="text-xs shrink-0">
                  {statusInfo.label}
                </Badge>
              </div>

              {/* Catering types */}
              <div className="flex flex-wrap gap-1">
                {order.catering_types.map((type) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {CATERING_TYPE_LABELS[type] || type}
                  </Badge>
                ))}
              </div>


              {/* Comment */}
              {order.comment && (
                <div className="text-xs text-muted-foreground italic">
                  "{order.comment}"
                </div>
              )}

              {/* Status actions */}
              {order.status === "pending" && (
                <div className="flex gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => updateStatus(order.id, "confirmed")}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Bekræft
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => updateStatus(order.id, "cancelled")}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Afvis
                  </Button>
                </div>
              )}
              {order.status === "confirmed" && (
                <div className="flex gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => updateStatus(order.id, "delivered")}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Leveret
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => updateStatus(order.id, "cancelled")}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Annullér
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export type { CateringOrder };
