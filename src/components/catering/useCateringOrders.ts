import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";
import type { ExistingOrder } from "./types";
import { buildMeetingOrderKey } from "./orderKey";

export const useCateringOrders = (currentWeekStart: Date) => {
  const [existingOrders, setExistingOrders] = useState<Record<string, ExistingOrder>>({});

  const fetchExistingOrders = async () => {
    const weekStart = format(currentWeekStart, "yyyy-MM-dd");
    const weekEnd = format(addDays(currentWeekStart, 5), "yyyy-MM-dd");

    try {
      // Fetch orders WITHOUT relation join (avoids PGRST200 error)
      const { data: orders, error: ordersError } = await supabase
        .from("catering_orders")
        .select("id, meeting_subject, meeting_date, meeting_time, meeting_location, status, person_count, catering_types, comment, user_id, meeting_external_id")
        .gte("meeting_date", weekStart)
        .lte("meeting_date", weekEnd)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Error fetching catering orders:", ordersError);
        setExistingOrders({});
        return;
      }

      if (!orders || orders.length === 0) {
        setExistingOrders({});
        return;
      }

      // Fetch profiles separately
      const userIds = [...new Set(orders.map((o) => o.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap: Record<string, { full_name: string | null; email: string }> = {};
      (profiles || []).forEach((p) => {
        profileMap[p.id] = { full_name: p.full_name, email: p.email };
      });

      // Build order map keyed by BOTH external ID and legacy key
      const orderMap: Record<string, ExistingOrder> = {};
      orders.forEach((o) => {
        const profile = profileMap[o.user_id];
        const order: ExistingOrder = {
          status: o.status,
          id: o.id,
          person_count: o.person_count,
          catering_types: o.catering_types,
          comment: o.comment,
          user_id: o.user_id,
          orderer_name: profile?.full_name || profile?.email || null,
          meeting_external_id: o.meeting_external_id,
        };

        // Primary key: external meeting ID
        if (o.meeting_external_id) {
          if (!orderMap[o.meeting_external_id]) {
            orderMap[o.meeting_external_id] = order;
          }
        }

        // Fallback key: date|time|location (for backward compat)
        const legacyKey = buildMeetingOrderKey(o.meeting_date, o.meeting_time, o.meeting_location);
        if (!orderMap[legacyKey]) {
          orderMap[legacyKey] = order;
        }
      });

      setExistingOrders(orderMap);
    } catch (err) {
      console.error("Unexpected error in fetchExistingOrders:", err);
      setExistingOrders({});
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
