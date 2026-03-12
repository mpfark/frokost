import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Palmtree, CalendarIcon, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addDays, isWeekend, isBefore, startOfDay, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface AbsenceManagerProps {
  userId: string;
}

interface AbsencePeriod {
  startDate: string;
  endDate: string;
  dates: { id: string; lunch_date: string }[];
}

/** Group consecutive weekday optouts into periods */
function groupIntoPeriods(optouts: { id: string; lunch_date: string }[]): AbsencePeriod[] {
  if (optouts.length === 0) return [];

  const sorted = [...optouts].sort((a, b) => a.lunch_date.localeCompare(b.lunch_date));
  const periods: AbsencePeriod[] = [];
  let currentDates = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1].lunch_date);
    const curr = parseISO(sorted[i].lunch_date);

    // Check if current date is the next weekday after previous
    let expected = addDays(prev, 1);
    while (isWeekend(expected)) expected = addDays(expected, 1);

    if (format(curr, "yyyy-MM-dd") === format(expected, "yyyy-MM-dd")) {
      currentDates.push(sorted[i]);
    } else {
      periods.push({
        startDate: currentDates[0].lunch_date,
        endDate: currentDates[currentDates.length - 1].lunch_date,
        dates: currentDates,
      });
      currentDates = [sorted[i]];
    }
  }

  periods.push({
    startDate: currentDates[0].lunch_date,
    endDate: currentDates[currentDates.length - 1].lunch_date,
    dates: currentDates,
  });

  return periods;
}

export const AbsenceManager = ({ userId }: AbsenceManagerProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [periods, setPeriods] = useState<AbsencePeriod[]>([]);
  const [isFetchingPeriods, setIsFetchingPeriods] = useState(true);
  const [deletingPeriodIdx, setDeletingPeriodIdx] = useState<number | null>(null);

  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");

  const fetchOptouts = useCallback(async () => {
    setIsFetchingPeriods(true);
    const { data, error } = await supabase
      .from("lunch_optouts")
      .select("id, lunch_date")
      .eq("user_id", userId)
      .gte("lunch_date", todayStr)
      .order("lunch_date", { ascending: true });

    if (!error && data) {
      setPeriods(groupIntoPeriods(data));
    }
    setIsFetchingPeriods(false);
  }, [userId, todayStr]);

  useEffect(() => {
    fetchOptouts();
  }, [fetchOptouts]);

  const generateWeekdays = (start: Date, end: Date): string[] => {
    const weekdays: string[] = [];
    let current = startOfDay(start);
    const endDay = startOfDay(end);
    while (!isBefore(endDay, current)) {
      if (!isWeekend(current)) weekdays.push(format(current, "yyyy-MM-dd"));
      current = addDays(current, 1);
    }
    return weekdays;
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error("Vælg venligst både start- og slutdato");
      return;
    }

    const startDay = startOfDay(startDate);
    const endDay = startOfDay(endDate);

    if (isBefore(startDay, today)) {
      toast.error("Startdato kan ikke være i fortiden");
      return;
    }
    if (isBefore(endDay, startDay)) {
      toast.error("Slutdato skal være efter startdato");
      return;
    }

    setIsSubmitting(true);
    try {
      const allWeekdays = generateWeekdays(startDay, endDay);
      if (allWeekdays.length === 0) {
        toast.error("Der er ingen hverdage i den valgte periode");
        setIsSubmitting(false);
        return;
      }

      const [{ data: closedDates }, { data: existingOptouts }, { data: existingSignups }] = await Promise.all([
        supabase.from("closed_dates").select("date").gte("date", allWeekdays[0]).lte("date", allWeekdays[allWeekdays.length - 1]),
        supabase.from("lunch_optouts").select("lunch_date").eq("user_id", userId).gte("lunch_date", allWeekdays[0]).lte("lunch_date", allWeekdays[allWeekdays.length - 1]),
        supabase.from("lunch_signups").select("lunch_date").eq("user_id", userId).gte("lunch_date", allWeekdays[0]).lte("lunch_date", allWeekdays[allWeekdays.length - 1]),
      ]);

      const closedSet = new Set(closedDates?.map(d => d.date) || []);
      const optoutSet = new Set(existingOptouts?.map(o => o.lunch_date) || []);
      const signupSet = new Set(existingSignups?.map(s => s.lunch_date) || []);

      const datesToOptout = allWeekdays.filter(d => !closedSet.has(d) && !optoutSet.has(d) && !signupSet.has(d));

      if (datesToOptout.length === 0) {
        toast.info("Alle hverdage i perioden er enten lukket, allerede frameldt, eller du er allerede tilmeldt");
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from("lunch_optouts").insert(datesToOptout.map(date => ({ user_id: userId, lunch_date: date })));

      if (error) {
        toast.error("Kunne ikke gemme fravær");
      } else {
        toast.success(`Fravær registreret! Du er nu frameldt ${datesToOptout.length} dag${datesToOptout.length === 1 ? "" : "e"}`);
        setDialogOpen(false);
        setStartDate(undefined);
        setEndDate(undefined);
        fetchOptouts();
      }
    } catch {
      toast.error("Der opstod en fejl ved registrering af fravær");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePeriod = async (periodIdx: number) => {
    const period = periods[periodIdx];
    setDeletingPeriodIdx(periodIdx);
    try {
      const ids = period.dates.map(d => d.id);
      const { error } = await supabase.from("lunch_optouts").delete().in("id", ids);
      if (error) {
        toast.error("Kunne ikke annullere fravær");
      } else {
        toast.success("Fravær annulleret");
        fetchOptouts();
      }
    } catch {
      toast.error("Der opstod en fejl");
    } finally {
      setDeletingPeriodIdx(null);
    }
  };

  const formatPeriodLabel = (p: AbsencePeriod) => {
    const start = format(parseISO(p.startDate), "d. MMM", { locale: da });
    const end = format(parseISO(p.endDate), "d. MMM yyyy", { locale: da });
    if (p.startDate === p.endDate) return start + " " + format(parseISO(p.startDate), "yyyy");
    return `${start} – ${end}`;
  };

  return (
    <div className="space-y-3">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Palmtree className="w-4 h-4 mr-2" />
            Meld fravær
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Meld fravær</DialogTitle>
            <DialogDescription>
              Vælg en periode (ferie, barsel, mv.), og du bliver automatisk frameldt frokost på alle hverdage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Startdato</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: da }) : <span>Vælg startdato</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} disabled={(date) => isBefore(startOfDay(date), today)} initialFocus locale={da} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Slutdato</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: da }) : <span>Vælg slutdato</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(date) => isBefore(startOfDay(date), startDate || today)} initialFocus locale={da} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {startDate && endDate && (
              <p className="text-sm text-muted-foreground">
                Du melder dig fra frokost i {generateWeekdays(startDate, endDate).length} hverdage
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setStartDate(undefined); setEndDate(undefined); }}>
              Annuller
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !startDate || !endDate}>
              {isSubmitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gemmer...</>) : "Gem fravær"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing absence periods */}
      {isFetchingPeriods ? (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : periods.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Kommende fravær</Label>
          {periods.map((period, idx) => (
            <div key={period.startDate} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">{formatPeriodLabel(period)}</span>
                <Badge variant="secondary" className="text-xs">
                  {period.dates.length} dag{period.dates.length !== 1 ? "e" : ""}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => handleDeletePeriod(idx)}
                disabled={deletingPeriodIdx === idx}
              >
                {deletingPeriodIdx === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
