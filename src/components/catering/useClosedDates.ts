import { useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export type ClosedDatesMap = Record<string, string | null>;

export const useClosedDates = (weekStart: Date) => {
  const [closedDates, setClosedDates] = useState<ClosedDatesMap>({});

  useEffect(() => {
    const start = format(weekStart, "yyyy-MM-dd");
    const end = format(addDays(weekStart, 4), "yyyy-MM-dd");
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("closed_dates")
        .select("date, reason")
        .gte("date", start)
        .lte("date", end);
      if (cancelled) return;
      const map: ClosedDatesMap = {};
      (data || []).forEach((d: any) => { map[d.date] = d.reason ?? null; });
      setClosedDates(map);
    })();
    return () => { cancelled = true; };
  }, [weekStart]);

  return closedDates;
};
