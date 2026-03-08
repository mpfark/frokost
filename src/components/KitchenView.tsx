import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek, getWeek, addMonths, startOfMonth, isWeekend, subDays } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UtensilsCrossed, Users, Wheat, Milk, Leaf, Lock, ChevronLeft, ChevronRight, Trash2, CalendarDays, Plus, Sparkles, UserX, UserCheck, CalendarCheck } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { getUpcomingDanishHolidays, filterAlreadyClosedHolidays, type DanishHoliday } from "@/lib/danishHolidays";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CateringOrdersSection, type CateringOrder } from "@/components/kitchen/CateringOrdersSection";

interface Guest {
  id: string;
  signup_id: string;
  is_gluten_free: boolean;
  is_lactose_free: boolean;
  is_vegetarian: boolean;
}

interface LunchSignup {
  id: string;
  user_id: string;
  lunch_date: string;
  guest_count: number;
  marked_absent_at: string | null;
  profiles: {
    full_name: string | null;
    email: string;
    is_gluten_free: boolean;
    is_lactose_free: boolean;
    is_vegetarian: boolean;
  } | null;
}

interface ClosedDate {
  id: string;
  date: string;
  reason: string | null;
}

export const KitchenView = () => {
  const [signups, setSignups] = useState<LunchSignup[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [cateringOrders, setCateringOrders] = useState<CateringOrder[]>([]);
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reasonDialogDate, setReasonDialogDate] = useState<Date | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [weeksToDisplay, setWeeksToDisplay] = useState(3);
  const [isAddingHolidays, setIsAddingHolidays] = useState(false);
  const [selectedDayTab, setSelectedDayTab] = useState<Date>(() => {
    // Start with today, but if it's a weekend, move to next Monday
    const today = new Date();
    if (isWeekend(today)) {
      const day = today.getDay();
      const daysToAdd = day === 0 ? 1 : 8 - day;
      return addDays(today, daysToAdd);
    }
    return today;
  });
  const isMobile = useIsMobile();

  // Get upcoming holidays filtered by already closed dates
  const suggestedHolidays = useMemo(() => {
    const allHolidays = getUpcomingDanishHolidays();
    return filterAlreadyClosedHolidays(allHolidays, closedDates);
  }, [closedDates]);

  const officialHolidays = suggestedHolidays.filter(h => h.official);
  const optionalHolidays = suggestedHolidays.filter(h => !h.official);

  const today = new Date();
  const startDate = startOfWeek(today, { weekStartsOn: 1 });

  // Create weeks of data based on company settings
  const weeks = Array.from({ length: weeksToDisplay }, (_, weekIndex) => {
    const weekStart = addDays(startDate, weekIndex * 7);
    const weekNumber = getWeek(weekStart, { weekStartsOn: 1 });
    const days = Array.from({ length: 5 }, (_, dayIndex) => 
      addDays(weekStart, dayIndex)
    );
    return { weekNumber, days };
  });

  const fetchSignups = async () => {
    const endDate = addDays(startDate, (weeksToDisplay * 7) - 1);
    const { data, error } = await supabase
      .from("lunch_signups")
      .select("*, profiles(full_name, email, is_gluten_free, is_lactose_free, is_vegetarian)")
      .gte("lunch_date", format(startDate, "yyyy-MM-dd"))
      .lte("lunch_date", format(endDate, "yyyy-MM-dd"))
      .order("lunch_date", { ascending: true });

    if (error) {
      console.error("Error fetching signups:", error);
      return;
    }

    setSignups((data as LunchSignup[]) || []);
  };

  const toggleAbsentStatus = async (signupId: string, isCurrentlyAbsent: boolean) => {
    const { error } = await supabase
      .from("lunch_signups")
      .update({ 
        marked_absent_at: isCurrentlyAbsent ? null : new Date().toISOString() 
      })
      .eq("id", signupId);

    if (error) {
      console.error("Error updating absence status:", error);
      toast.error("Kunne ikke opdatere fraværsstatus");
      return;
    }

    toast.success(isCurrentlyAbsent ? "Fravær fjernet" : "Markeret fraværende");
    fetchSignups();
  };

  const fetchClosedDates = async () => {
    const { data } = await supabase
      .from("closed_dates")
      .select("*");

    setClosedDates(data || []);
  };

  const fetchGuests = async () => {
    const signupIds = signups.map(s => s.id);
    if (signupIds.length === 0) {
      setGuests([]);
      return;
    }

    // Batch requests to avoid URL length issues
    const BATCH_SIZE = 50;
    const batches: string[][] = [];
    for (let i = 0; i < signupIds.length; i += BATCH_SIZE) {
      batches.push(signupIds.slice(i, i + BATCH_SIZE));
    }

    const results = await Promise.all(
      batches.map(batch =>
        supabase.from("guests").select("*").in("signup_id", batch)
      )
    );

    const error = results.find(r => r.error)?.error;
    if (error) {
      console.error("Error fetching guests:", error);
      return;
    }

    const allGuests = results.flatMap(r => r.data || []);
    setGuests(allGuests);
  };

  const fetchCompanySettings = async () => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("weeks_to_display")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching company settings:", error);
      return;
    }

    if (data) {
      setWeeksToDisplay(data.weeks_to_display || 3);
    }
  };

  const fetchCateringOrders = async () => {
    const endDate = addDays(startDate, (weeksToDisplay * 7) - 1);
    const { data, error } = await supabase
      .from("catering_orders")
      .select("*")
      .gte("meeting_date", format(startDate, "yyyy-MM-dd"))
      .lte("meeting_date", format(endDate, "yyyy-MM-dd"))
      .order("meeting_time", { ascending: true });

    if (error) {
      console.error("Error fetching catering orders:", error);
      return;
    }

    // Fetch profile info for each order
    const userIds = [...new Set((data || []).map(o => o.user_id))];
    let profileMap: Record<string, { full_name: string | null; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (profiles) {
        profileMap = Object.fromEntries(profiles.map(p => [p.id, { full_name: p.full_name, email: p.email }]));
      }
    }

    const ordersWithProfiles = (data || []).map(o => ({
      ...o,
      profiles: profileMap[o.user_id] || null,
    }));

    setCateringOrders(ordersWithProfiles as CateringOrder[]);
  };

  const toggleClosedDate = async (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const existingClosed = closedDates.find((cd) => cd.date === dateStr);

    if (existingClosed) {
      // Remove closed date
      const { error } = await supabase
        .from("closed_dates")
        .delete()
        .eq("id", existingClosed.id);

      if (error) {
        toast.error("Kunne ikke åbne dato igen");
        return;
      }

      toast.success("Dato åbnet igen");
      fetchClosedDates();
    } else {
      // Show reason dialog
      setReasonDialogDate(date);
    }
  };

  const addClosedDateWithReason = async () => {
    if (!reasonDialogDate) return;

    const { error } = await supabase
      .from("closed_dates")
      .insert({ date: format(reasonDialogDate, "yyyy-MM-dd"), reason: reasonInput || null });

    if (error) {
      toast.error("Kunne ikke lukke dato");
      return;
    }

    toast.success("Dato markeret som lukket");
    setReasonDialogDate(null);
    setReasonInput("");
    fetchClosedDates();
  };

  const addHolidayAsClosedDate = async (holiday: DanishHoliday) => {
    const { error } = await supabase
      .from("closed_dates")
      .insert({ date: format(holiday.date, "yyyy-MM-dd"), reason: holiday.name });

    if (error) {
      toast.error("Kunne ikke tilføje helligdag");
      return;
    }

    toast.success(`${holiday.name} tilføjet som lukket dag`);
    fetchClosedDates();
  };

  const addAllOfficialHolidays = async () => {
    if (officialHolidays.length === 0) {
      toast.info("Alle officielle helligdage er allerede tilføjet");
      return;
    }

    setIsAddingHolidays(true);
    
    const holidaysToAdd = officialHolidays.map(h => ({
      date: format(h.date, "yyyy-MM-dd"),
      reason: h.name
    }));

    const { error } = await supabase
      .from("closed_dates")
      .insert(holidaysToAdd);

    setIsAddingHolidays(false);

    if (error) {
      toast.error("Kunne ikke tilføje helligdage");
      return;
    }

    toast.success(`${holidaysToAdd.length} officielle helligdage tilføjet`);
    fetchClosedDates();
  };

  const removeSignup = async (signupId: string) => {
    const { error } = await supabase
      .from("lunch_signups")
      .delete()
      .eq("id", signupId);

    if (error) {
      console.error("Error deleting signup:", error);
      toast.error("Kunne ikke fjerne tilmelding");
      return;
    }

    toast.success("Tilmelding fjernet");
    fetchSignups();
  };

  const removeGuest = async (guestId: string) => {
    const { error } = await supabase
      .from("guests")
      .delete()
      .eq("id", guestId);

    if (error) {
      console.error("Error deleting guest:", error);
      toast.error("Kunne ikke fjerne gæst");
      return;
    }

    toast.success("Gæst fjernet");
    fetchGuests();
  };

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  useEffect(() => {
    if (weeksToDisplay > 0) {
      fetchSignups();
      fetchClosedDates();
      fetchCateringOrders();
    }
  }, [weeksToDisplay]);

  useEffect(() => {
    if (signups.length > 0) {
      fetchGuests();
    }
  }, [signups]);

  // Debounce utility for realtime updates
  const debounceTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  
  const debouncedFetch = useCallback((key: string, fn: () => void, delay: number = 300) => {
    if (debounceTimeoutRef.current[key]) {
      clearTimeout(debounceTimeoutRef.current[key]);
    }
    debounceTimeoutRef.current[key] = setTimeout(fn, delay);
  }, []);

  useEffect(() => {
    const signupsChannel = supabase
      .channel("kitchen_view_signups")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lunch_signups",
        },
        () => {
          debouncedFetch("signups", fetchSignups);
        }
      )
      .subscribe();

    const closedDatesChannel = supabase
      .channel("kitchen_closed_dates_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "closed_dates",
        },
        () => {
          debouncedFetch("closedDates", fetchClosedDates);
        }
      )
      .subscribe();

    const guestsChannel = supabase
      .channel("kitchen_guests_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guests",
        },
        () => {
          debouncedFetch("guests", fetchGuests);
        }
      )
      .subscribe();

    const cateringChannel = supabase
      .channel("kitchen_catering_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "catering_orders",
        },
        () => {
          debouncedFetch("catering", fetchCateringOrders);
        }
      )
      .subscribe();

    return () => {
      // Clear all debounce timeouts
      Object.values(debounceTimeoutRef.current).forEach(clearTimeout);
      supabase.removeChannel(signupsChannel);
      supabase.removeChannel(closedDatesChannel);
      supabase.removeChannel(guestsChannel);
      supabase.removeChannel(cateringChannel);
    };
  }, [debouncedFetch]);

  const getCateringOrdersForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return cateringOrders.filter((o) => o.meeting_date === dateStr);
  };

  const getSignupsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return signups.filter((s) => s.lunch_date === dateStr);
  };

  const getTotalPeopleForDate = (date: Date) => {
    const daySignups = getSignupsForDate(date);
    return daySignups.length + daySignups.reduce((sum, s) => sum + s.guest_count, 0);
  };

  const getExpectedPeopleForDate = (date: Date) => {
    const daySignups = getSignupsForDate(date);
    const presentSignups = daySignups.filter(s => !s.marked_absent_at);
    return presentSignups.length + presentSignups.reduce((sum, s) => sum + s.guest_count, 0);
  };

  const getAbsentCountForDate = (date: Date) => {
    const daySignups = getSignupsForDate(date);
    return daySignups.filter(s => s.marked_absent_at).length;
  };

  const isDateClosed = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return closedDates.some((cd) => cd.date === dateStr);
  };

  const isPastDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return dateStr < todayStr;
  };

  const getGuestsForSignups = (signupIds: string[]) => {
    return guests.filter(g => signupIds.includes(g.signup_id));
  };

  const getDietaryCounts = (daySignups: LunchSignup[]) => {
    const signupIds = daySignups.map(s => s.id);
    const dayGuests = getGuestsForSignups(signupIds);

    // Collect all people with their dietary restrictions
    const allPeople = [
      ...daySignups.map(s => ({
        isGlutenFree: s.profiles?.is_gluten_free || false,
        isLactoseFree: s.profiles?.is_lactose_free || false,
        isVegetarian: s.profiles?.is_vegetarian || false,
      })),
      ...dayGuests.map(g => ({
        isGlutenFree: g.is_gluten_free,
        isLactoseFree: g.is_lactose_free,
        isVegetarian: g.is_vegetarian,
      }))
    ];

    // Group by dietary restriction combinations
    const combinations = new Map<string, number>();
    
    allPeople.forEach(person => {
      if (person.isGlutenFree || person.isLactoseFree || person.isVegetarian) {
        const key = [
          person.isGlutenFree ? 'GF' : '',
          person.isLactoseFree ? 'LF' : '',
          person.isVegetarian ? 'V' : ''
        ].filter(Boolean).join('+');
        
        combinations.set(key, (combinations.get(key) || 0) + 1);
      }
    });

    return combinations;
  };

  // Navigation functions for day tab
  const navigateToPreviousWeekday = () => {
    let newDate = subDays(selectedDayTab, 1);
    while (isWeekend(newDate)) {
      newDate = subDays(newDate, 1);
    }
    setSelectedDayTab(newDate);
  };

  const navigateToNextWeekday = () => {
    let newDate = addDays(selectedDayTab, 1);
    while (isWeekend(newDate)) {
      newDate = addDays(newDate, 1);
    }
    setSelectedDayTab(newDate);
  };

  // Get signups for the selected day tab
  const dayTabSignups = useMemo(() => {
    const dateStr = format(selectedDayTab, "yyyy-MM-dd");
    return signups
      .filter((s) => s.lunch_date === dateStr)
      .sort((a, b) => {
        // First priority: guests (more guests = higher priority)
        if (b.guest_count !== a.guest_count) {
          return b.guest_count - a.guest_count;
        }
        // Second priority: dietary restrictions
        const aDietary = (a.profiles?.is_gluten_free ? 1 : 0) + (a.profiles?.is_lactose_free ? 1 : 0) + (a.profiles?.is_vegetarian ? 1 : 0);
        const bDietary = (b.profiles?.is_gluten_free ? 1 : 0) + (b.profiles?.is_lactose_free ? 1 : 0) + (b.profiles?.is_vegetarian ? 1 : 0);
        if (bDietary !== aDietary) {
          return bDietary - aDietary;
        }
        // Third priority: alphabetical by name
        const aName = a.profiles?.full_name || a.profiles?.email || '';
        const bName = b.profiles?.full_name || b.profiles?.email || '';
        return aName.localeCompare(bName, 'da');
      });
  }, [signups, selectedDayTab]);

  const dayTabStats = useMemo(() => {
    const total = dayTabSignups.length + dayTabSignups.reduce((sum, s) => sum + s.guest_count, 0);
    const absentSignups = dayTabSignups.filter(s => s.marked_absent_at);
    const absentCount = absentSignups.length;
    const expected = dayTabSignups.filter(s => !s.marked_absent_at).length + 
      dayTabSignups.filter(s => !s.marked_absent_at).reduce((sum, s) => sum + s.guest_count, 0);
    const guestCount = dayTabSignups.reduce((sum, s) => sum + s.guest_count, 0);
    const dietaryCounts = getDietaryCounts(dayTabSignups);
    const isClosed = isDateClosed(selectedDayTab);
    
    return { total, expected, absentCount, guestCount, dietaryCounts, isClosed };
  }, [dayTabSignups, selectedDayTab, closedDates]);

  return (
    <Tabs defaultValue="day" className="w-full">
      <TabsList className="grid w-full max-w-2xl mx-auto mb-8 grid-cols-3 h-auto">
        <TabsTrigger value="day" className="flex items-center gap-2">
          <CalendarCheck className="w-4 h-4" />
          Dag
        </TabsTrigger>
        <TabsTrigger value="signups" className="flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4" />
          Uge
        </TabsTrigger>
        <TabsTrigger value="closed" className="flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Lukkede dage
        </TabsTrigger>
      </TabsList>

      {/* Day Tab Content */}
      <TabsContent value="day" className="space-y-4">
        <Card>
          <CardContent className="p-4 md:p-6">
            {/* Navigation header */}
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="outline"
                size="icon"
                onClick={navigateToPreviousWeekday}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <div className="text-lg md:text-xl font-semibold capitalize">
                  {format(selectedDayTab, "EEEE", { locale: da })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(selectedDayTab, "d. MMMM yyyy", { locale: da })}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={navigateToNextWeekday}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {dayTabStats.isClosed ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Lock className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Denne dag er lukket</p>
              </div>
            ) : (
              <div className={`grid gap-6 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                {/* Left Column - Overview */}
                <div className="space-y-4">
                  {/* Summary stats */}
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-primary" />
                      <span className="font-medium">
                        {dayTabStats.expected} forventet
                        {dayTabStats.absentCount > 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({dayTabStats.total} total)
                          </span>
                        )}
                      </span>
                    </div>
                    {dayTabStats.absentCount > 0 && (
                      <div className="flex items-center gap-3">
                        <UserX className="w-5 h-5 text-destructive" />
                        <span className="text-muted-foreground">
                          {dayTabStats.absentCount} fravær
                        </span>
                      </div>
                    )}
                    {dayTabStats.guestCount > 0 && (
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {dayTabStats.guestCount} {dayTabStats.guestCount === 1 ? 'gæst' : 'gæster'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Dietary restrictions */}
                  {dayTabStats.dietaryCounts.size > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Kostrestriktioner</h4>
                      <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                        {Array.from(dayTabStats.dietaryCounts.entries())
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([combo, count]) => (
                            <div key={combo} className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                {combo.includes('GF') && <Wheat className="w-4 h-4" />}
                                {combo.includes('LF') && <Milk className="w-4 h-4" />}
                                {combo.includes('V') && <Leaf className="w-4 h-4" />}
                              </div>
                              <span className="text-sm">
                                {combo.split('+').map(c => {
                                  if (c === 'GF') return 'Glutenfri';
                                  if (c === 'LF') return 'Laktosefri';
                                  if (c === 'V') return 'Vegetar';
                                  return c;
                                }).join(' + ')}: {count}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {dayTabSignups.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Ingen tilmeldinger for denne dag
                    </div>
                  )}
                </div>

                {/* Right Column - Signups list */}
                {dayTabSignups.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      Tilmeldte ({dayTabSignups.length})
                    </h4>
                    <ScrollArea className="h-[400px] md:h-[500px]">
                      <div className="space-y-2 pr-4">
                        {dayTabSignups.map((signup) => {
                          const signupGuests = guests.filter(g => g.signup_id === signup.id);
                          const isAbsent = !!signup.marked_absent_at;

                          return (
                            <div
                              key={signup.id}
                              className={`p-3 border rounded-lg ${isAbsent ? "opacity-60 bg-muted/30" : "bg-card"}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium flex items-center gap-2 flex-wrap ${isAbsent ? "line-through" : ""}`}>
                                    <span className="truncate">
                                      {signup.profiles?.full_name || signup.profiles?.email || 'Unknown User'}
                                    </span>
                                    {signup.guest_count > 0 && !isAbsent && (
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        +{signup.guest_count} gæst{signup.guest_count > 1 ? 'er' : ''}
                                      </Badge>
                                    )}
                                    {isAbsent && (
                                      <Badge variant="secondary" className="text-xs shrink-0">
                                        Fraværende
                                      </Badge>
                                    )}
                                  </div>
                                  {/* User dietary restrictions */}
                                  {(signup.profiles?.is_gluten_free || signup.profiles?.is_lactose_free || signup.profiles?.is_vegetarian) && (
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                      {signup.profiles?.is_gluten_free && (
                                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                          <Wheat className="w-3 h-3" />
                                          GF
                                        </Badge>
                                      )}
                                      {signup.profiles?.is_lactose_free && (
                                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                          <Milk className="w-3 h-3" />
                                          LF
                                        </Badge>
                                      )}
                                      {signup.profiles?.is_vegetarian && (
                                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                          <Leaf className="w-3 h-3" />
                                          V
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  {/* Guest dietary restrictions */}
                                  {signupGuests.length > 0 && (
                                    <div className="mt-2 ml-2 space-y-1">
                                      {signupGuests.map((guest, index) => {
                                        const hasRestrictions = guest.is_gluten_free || guest.is_lactose_free || guest.is_vegetarian;
                                        return (
                                          <div key={guest.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>Gæst {index + 1}:</span>
                                            {hasRestrictions ? (
                                              <div className="flex gap-1">
                                                {guest.is_gluten_free && (
                                                  <Badge variant="outline" className="text-xs flex items-center gap-0.5 py-0">
                                                    <Wheat className="w-3 h-3" />
                                                    GF
                                                  </Badge>
                                                )}
                                                {guest.is_lactose_free && (
                                                  <Badge variant="outline" className="text-xs flex items-center gap-0.5 py-0">
                                                    <Milk className="w-3 h-3" />
                                                    LF
                                                  </Badge>
                                                )}
                                                {guest.is_vegetarian && (
                                                  <Badge variant="outline" className="text-xs flex items-center gap-0.5 py-0">
                                                    <Leaf className="w-3 h-3" />
                                                    V
                                                  </Badge>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground/60">Ingen restriktioner</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleAbsentStatus(signup.id, isAbsent)}
                                    className={isAbsent ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}
                                    title={isAbsent ? "Marker som tilstede" : "Marker som fraværende"}
                                  >
                                    {isAbsent ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeSignup(signup.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="signups" className="space-y-4">
      {weeks.map(({ weekNumber, days }) => (
        <Card key={weekNumber}>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Week Number */}
              <div className="flex-shrink-0 flex flex-row md:flex-col items-center justify-center bg-muted rounded-lg px-4 py-2 md:min-w-[80px] gap-2 md:gap-0">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Uge</div>
                <div className="text-2xl md:text-4xl font-bold text-foreground">{weekNumber}</div>
              </div>

              {/* Days Grid */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {days.map((date) => {
                  const daySignups = getSignupsForDate(date);
                  const totalPeople = getTotalPeopleForDate(date);
                  const expectedPeople = getExpectedPeopleForDate(date);
                  const absentCount = getAbsentCountForDate(date);
                  const memberCount = daySignups.length;
                  const guestCount = daySignups.reduce((sum, s) => sum + s.guest_count, 0);
                  const isPast = isPastDate(date);
                  const isClosed = isDateClosed(date);
                  const dietaryCounts = getDietaryCounts(daySignups);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`border rounded-lg p-2 ${isPast || isClosed ? "opacity-60 bg-muted/50" : "bg-card hover:bg-accent/50"} ${daySignups.length > 0 ? "cursor-pointer transition-colors" : ""}`}
                      onClick={() => daySignups.length > 0 && setSelectedDate(date)}
                    >
                      {/* Header row - dag/dato venstre, antal højre */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-left">
                          <div className="text-xs text-muted-foreground font-medium">
                            {format(date, "EEEE", { locale: da })}
                          </div>
                          <div className="text-sm font-semibold">
                            {format(date, "d. MMM", { locale: da })}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            variant={daySignups.length > 0 ? "default" : "secondary"}
                            className="flex items-center gap-1"
                          >
                            <Users className="w-3 h-3" />
                            <span>{expectedPeople}</span>
                            {absentCount > 0 && (
                              <span className="text-xs opacity-80">/{totalPeople}</span>
                            )}
                          </Badge>
                          {absentCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <UserX className="w-3 h-3" />
                              {absentCount} fravær
                            </div>
                          )}
                          {guestCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />
                              {guestCount} {guestCount === 1 ? 'gæst' : 'gæster'}
                            </div>
                          )}
                          {isClosed && (
                            <div className="flex items-center gap-1 text-xs text-destructive">
                              <Lock className="w-3 h-3" />
                              Lukket
                            </div>
                          )}
                          {/* Kostrestriktioner stablet vertikalt */}
                          {daySignups.length > 0 && dietaryCounts.size > 0 && (
                            <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                              {Array.from(dietaryCounts.entries())
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([combo, count]) => (
                                <div key={combo} className="flex items-center gap-0.5">
                                  {combo.includes('GF') && <Wheat className="w-3 h-3" />}
                                  {combo.includes('LF') && <Milk className="w-3 h-3" />}
                                  {combo.includes('V') && <Leaf className="w-3 h-3" />}
                                  <span>{count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      </TabsContent>

      <TabsContent value="closed" className="space-y-4">
      {/* Manage Closed Dates - Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Administrer lukkede dage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side - Calendar */}
            <div className="flex flex-col">
              <Calendar
                mode="single"
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                weekStartsOn={1}
                modifiers={{
                  closed: closedDates.map((cd) => new Date(cd.date + "T00:00:00")),
                }}
                modifiersClassNames={{
                  closed: "bg-destructive/20 text-destructive font-bold line-through",
                }}
                onDayClick={toggleClosedDate}
                className="rounded-md border"
              />
              <p className="text-sm text-muted-foreground mt-4">
                Klik på en dato for at låse/åbne den. Låste dage forhindrer frokosttilmeldinger.
              </p>
            </div>

            {/* Right side - List of closed dates */}
            <div className="space-y-2 overflow-y-auto h-full">
              {closedDates
                .filter((cd) => new Date(cd.date) >= new Date(format(new Date(), "yyyy-MM-dd")))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((cd) => (
                  <div
                    key={cd.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 text-sm">
                      {format(new Date(cd.date + "T00:00:00"), "MMM d, yyyy")}
                      {cd.reason && (
                        <span className="text-muted-foreground ml-2">- {cd.reason}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleClosedDate(new Date(cd.date + "T00:00:00"))}
                    >
                      Åbn igen
                    </Button>
                  </div>
                ))}
              {closedDates.filter((cd) => new Date(cd.date) >= new Date(format(new Date(), "yyyy-MM-dd"))).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Ingen kommende lukkede dage</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Holidays */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Foreslåede lukkedage (Danske helligdage)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {suggestedHolidays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Alle kommende helligdage er allerede tilføjet som lukkede dage
            </p>
          ) : (
            <div className="space-y-4">
              {officialHolidays.length > 0 && (
                <Button
                  onClick={addAllOfficialHolidays}
                  disabled={isAddingHolidays}
                  className="w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tilføj alle officielle helligdage ({officialHolidays.length})
                </Button>
              )}

              {/* Official holidays */}
              {officialHolidays.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Officielle helligdage</h4>
                  <div className="grid gap-2">
                    {officialHolidays.map((holiday) => (
                      <div
                        key={holiday.date.toISOString()}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="default" className="text-xs">
                            {format(holiday.date, "d. MMM yyyy", { locale: da })}
                          </Badge>
                          <span className="font-medium">{holiday.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addHolidayAsClosedDate(holiday)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Tilføj
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional holidays */}
              {optionalHolidays.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Valgfrie lukkedage</h4>
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Disse dage er ikke officielle helligdage, men mange arbejdspladser holder lukket
                  </p>
                  <div className="grid gap-2">
                    {optionalHolidays.map((holiday) => (
                      <div
                        key={holiday.date.toISOString()}
                        className="flex items-center justify-between p-3 border border-dashed rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">
                            {format(holiday.date, "d. MMM yyyy", { locale: da })}
                          </Badge>
                          <span className="font-medium text-muted-foreground">{holiday.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => addHolidayAsClosedDate(holiday)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Tilføj
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <Drawer open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle>
              {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy", { locale: da })}
            </DrawerTitle>
            <DrawerDescription>
              {selectedDate && (() => {
                const total = getTotalPeopleForDate(selectedDate);
                const expected = getExpectedPeopleForDate(selectedDate);
                const absent = getAbsentCountForDate(selectedDate);
                const signupCount = getSignupsForDate(selectedDate).length;
                if (absent > 0) {
                  return `${signupCount} tilmeldt · ${absent} fraværende · ${expected} forventet`;
                }
                return `${total} personer i alt (${signupCount} tilmeldinger)`;
              })()}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-8 max-h-[60vh] overflow-y-auto">
            {selectedDate && getSignupsForDate(selectedDate)
              .sort((a, b) => {
                // First priority: guests (more guests = higher priority)
                if (b.guest_count !== a.guest_count) {
                  return b.guest_count - a.guest_count;
                }
                // Second priority: dietary restrictions
                const aDietary = (a.profiles?.is_gluten_free ? 1 : 0) + (a.profiles?.is_lactose_free ? 1 : 0) + (a.profiles?.is_vegetarian ? 1 : 0);
                const bDietary = (b.profiles?.is_gluten_free ? 1 : 0) + (b.profiles?.is_lactose_free ? 1 : 0) + (b.profiles?.is_vegetarian ? 1 : 0);
                if (bDietary !== aDietary) {
                  return bDietary - aDietary;
                }
                // Third priority: alphabetical by name
                const aName = a.profiles?.full_name || a.profiles?.email || '';
                const bName = b.profiles?.full_name || b.profiles?.email || '';
                return aName.localeCompare(bName, 'da');
              })
              .map((signup) => {
              const signupGuests = guests.filter(g => g.signup_id === signup.id);
              const dietaryInfo = [];
              if (signup.profiles?.is_gluten_free) dietaryInfo.push("GF");
              if (signup.profiles?.is_lactose_free) dietaryInfo.push("LF");
              if (signup.profiles?.is_vegetarian) dietaryInfo.push("V");
              
              const isAbsent = !!signup.marked_absent_at;
              
              return (
                <div key={signup.id} className={`py-3 border-b last:border-0 ${isAbsent ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className={`font-medium flex items-center gap-2 ${isAbsent ? "line-through" : ""}`}>
                        {signup.profiles?.full_name || signup.profiles?.email || 'Unknown User'}
                        {signup.guest_count > 0 && !isAbsent && (
                          <Badge variant="outline" className="text-xs">
                            +{signup.guest_count} gæst{signup.guest_count > 1 ? 'er' : ''}
                          </Badge>
                        )}
                        {isAbsent && (
                          <Badge variant="secondary" className="text-xs">
                            Fraværende
                          </Badge>
                        )}
                      </div>
                    {dietaryInfo.length > 0 && (
                      <div className="flex gap-2 mt-1">
                        {signup.profiles?.is_gluten_free && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Wheat className="w-3 h-3" />
                            Glutenfri
                          </Badge>
                        )}
                        {signup.profiles?.is_lactose_free && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Milk className="w-3 h-3" />
                            Laktosefri
                          </Badge>
                        )}
                        {signup.profiles?.is_vegetarian && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Leaf className="w-3 h-3" />
                            Vegetar
                          </Badge>
                        )}
                      </div>
                    )}
                    
                      {/* Guest dietary restrictions */}
                      {signupGuests.length > 0 && (
                        <div className="ml-4 mt-2 space-y-1">
                          {signupGuests.map((guest, index) => {
                            const guestDietary = [];
                            if (guest.is_gluten_free) guestDietary.push("GF");
                            if (guest.is_lactose_free) guestDietary.push("LF");
                            if (guest.is_vegetarian) guestDietary.push("V");
                            
                            if (guestDietary.length === 0) return (
                              <div key={guest.id} className="flex gap-2 items-center justify-between">
                                <span className="text-xs text-muted-foreground">Gæst {index + 1}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeGuest(guest.id)}
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            );
                            
                            return (
                              <div key={guest.id} className="flex gap-2 items-center justify-between">
                                <div className="flex gap-2 items-center">
                                  <span className="text-xs text-muted-foreground">Gæst {index + 1}:</span>
                                  <div className="flex gap-2">
                                    {guest.is_gluten_free && (
                                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                                        <Wheat className="w-3 h-3" />
                                        GF
                                      </Badge>
                                    )}
                                    {guest.is_lactose_free && (
                                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                                        <Milk className="w-3 h-3" />
                                        LF
                                      </Badge>
                                    )}
                                    {guest.is_vegetarian && (
                                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                                        <Leaf className="w-3 h-3" />
                                        V
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeGuest(guest.id)}
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAbsentStatus(signup.id, isAbsent);
                        }}
                        className={isAbsent ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}
                        title={isAbsent ? "Marker som tilstede" : "Marker som fraværende"}
                      >
                        {isAbsent ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSignup(signup.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Reason Dialog */}
      <Dialog open={reasonDialogDate !== null} onOpenChange={(open) => !open && setReasonDialogDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Luk dato</DialogTitle>
            <DialogDescription>
              {reasonDialogDate && format(reasonDialogDate, "EEEE, MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Årsag (valgfrit)"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReasonDialogDate(null)}>
                Annuller
              </Button>
              <Button onClick={addClosedDateWithReason}>
                Luk dato
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
};
