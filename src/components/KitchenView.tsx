import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek, getWeek, addMonths, startOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UtensilsCrossed, Users, Wheat, Milk, Leaf, Lock, ChevronLeft, ChevronRight, Trash2, CalendarDays, Plus, Sparkles } from "lucide-react";
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
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reasonDialogDate, setReasonDialogDate] = useState<Date | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [weeksToDisplay, setWeeksToDisplay] = useState(3);
  const [isAddingHolidays, setIsAddingHolidays] = useState(false);

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

    setSignups(data || []);
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

    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .in("signup_id", signupIds);

    if (error) {
      console.error("Error fetching guests:", error);
      return;
    }

    setGuests(data || []);
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
    }
  }, [weeksToDisplay]);

  useEffect(() => {
    if (signups.length > 0) {
      fetchGuests();
    }
  }, [signups]);

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
          fetchSignups();
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
          fetchClosedDates();
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
          fetchGuests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(signupsChannel);
      supabase.removeChannel(closedDatesChannel);
      supabase.removeChannel(guestsChannel);
    };
  }, [signups]);

  const getSignupsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return signups.filter((s) => s.lunch_date === dateStr);
  };

  const getTotalPeopleForDate = (date: Date) => {
    const daySignups = getSignupsForDate(date);
    return daySignups.length + daySignups.reduce((sum, s) => sum + s.guest_count, 0);
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

  return (
    <Tabs defaultValue="signups" className="w-full">
      <TabsList className="grid w-full max-w-2xl mx-auto mb-8 grid-cols-2 h-auto">
        <TabsTrigger value="signups" className="flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4" />
          Tilmeldinger
        </TabsTrigger>
        <TabsTrigger value="closed" className="flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Lukkede dage
        </TabsTrigger>
      </TabsList>

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
                            <span>{memberCount}</span>
                            {guestCount > 0 && <span className="text-xs opacity-80">+{guestCount}</span>}
                          </Badge>
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
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy", { locale: da })}
            </DrawerTitle>
            <DrawerDescription>
              {selectedDate && `${getTotalPeopleForDate(selectedDate)} personer i alt (${getSignupsForDate(selectedDate).length} tilmeldinger)`}
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
              
              return (
                <div key={signup.id} className="py-3 border-b last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {signup.profiles?.full_name || signup.profiles?.email || 'Unknown User'}
                        {signup.guest_count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            +{signup.guest_count} gæst{signup.guest_count > 1 ? 'er' : ''}
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
