import { useState, useMemo } from "react";
import { startOfWeek, addDays, format } from "date-fns";
import { da } from "date-fns/locale";

export const useWeekNavigation = (selectedDate?: Date) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const currentWeekStart = useMemo(() => {
    const base = selectedDate || new Date();
    return startOfWeek(addDays(base, weekOffset * 7), { weekStartsOn: 1 });
  }, [selectedDate, weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const weekLabel = `Uge ${format(currentWeekStart, "w", { locale: da })} — ${format(currentWeekStart, "d. MMM", { locale: da })} – ${format(addDays(currentWeekStart, 4), "d. MMM yyyy", { locale: da })}`;

  return { weekOffset, setWeekOffset, currentWeekStart, weekDays, weekLabel };
};
