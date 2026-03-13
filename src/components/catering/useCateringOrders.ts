import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";
import type { ExistingOrder } from "./types";

export const useCateringOrders = (currentWeekStart: Date) => {
  const [existingOrders, setExistingOrders] = useState<Record<string, ExistingOrder>>({});

  const fetchExistingOrders = async () => {
    const weekStart = format(currentWeekStart, "yyyy-MM-dd");
    const weekEnd = format(addDays(currentWeekStart, 5), "yyyy-MM-dd");

    const { data } = await supabase
      .from("catering_orders")
      .select("id, meeting_subject, meeting_date, meeting_time, meeting_location, status, person_count, catering_types, comment, user_id, profiles:user_id(full_name, email)")
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
          comment: o.comment,
          user_id: o.user_id,
          orderer_name: profile?.full_name || profile?.email || null,
        };
      });
      setExistingOrders(orderMap);
    }
  };

  // Initial fetch + realtime subscription
  useEffect(() => {
    fetchExistingOrders();
    const channel = supabase
      .channel(`catering_orders_rt_${currentWeekStart.toISOString()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "catering_orders" }, () => fetchExistingOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentWeekStart]);

  return { existingOrders, fetchExistingOrders };
};
