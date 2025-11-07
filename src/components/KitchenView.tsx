import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek, getWeek, addMonths, startOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { UtensilsCrossed, Users, Wheat, Milk, Leaf, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
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
  };
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

  const today = new Date();
  const startDate = startOfWeek(today, { weekStartsOn: 1 });

  // Create 3 weeks of data
  const weeks = Array.from({ length: 3 }, (_, weekIndex) => {
    const weekStart = addDays(startDate, weekIndex * 7);
    const weekNumber = getWeek(weekStart, { weekStartsOn: 1 });
    const days = Array.from({ length: 5 }, (_, dayIndex) => 
      addDays(weekStart, dayIndex)
    );
    return { weekNumber, days };
  });

  const fetchSignups = async () => {
    const { data, error } = await supabase
      .from("lunch_signups")
      .select("*, profiles(full_name, email, is_gluten_free, is_lactose_free, is_vegetarian)")
      .gte("lunch_date", format(startDate, "yyyy-MM-dd"))
      .lte("lunch_date", format(addDays(startDate, 20), "yyyy-MM-dd"))
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
        toast.error("Failed to reopen date");
        return;
      }

      toast.success("Date reopened");
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
      toast.error("Failed to close date");
      return;
    }

    toast.success("Date marked as closed");
    setReasonDialogDate(null);
    setReasonInput("");
    fetchClosedDates();
  };

  useEffect(() => {
    fetchSignups();
    fetchClosedDates();
  }, []);

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

    return {
      glutenFree: daySignups.filter(s => s.profiles.is_gluten_free).length + 
                  dayGuests.filter(g => g.is_gluten_free).length,
      lactoseFree: daySignups.filter(s => s.profiles.is_lactose_free).length + 
                   dayGuests.filter(g => g.is_lactose_free).length,
      vegetarian: daySignups.filter(s => s.profiles.is_vegetarian).length + 
                  dayGuests.filter(g => g.is_vegetarian).length,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
          <UtensilsCrossed className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Kitchen Dashboard</h1>
          <p className="text-muted-foreground">Next 3 weeks lunch schedule</p>
        </div>
      </div>

      {weeks.map(({ weekNumber, days }) => (
        <Card key={weekNumber}>
          <CardContent className="p-6">
            <div className="flex gap-4">
              {/* Week Number */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center bg-primary/10 rounded-lg px-4 py-2 min-w-[80px]">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Week</div>
                <div className="text-4xl font-bold text-primary">{weekNumber}</div>
              </div>

              {/* Days Grid */}
              <div className="flex-1 grid grid-cols-5 gap-3">
                {days.map((date) => {
                  const daySignups = getSignupsForDate(date);
                  const totalPeople = getTotalPeopleForDate(date);
                  const isPast = isPastDate(date);
                  const isClosed = isDateClosed(date);
                  const dietaryCounts = getDietaryCounts(daySignups);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`border rounded-lg p-3 ${isPast || isClosed ? "opacity-60 bg-muted/50" : "bg-card hover:bg-accent/50"} ${daySignups.length > 0 ? "cursor-pointer transition-colors" : ""}`}
                      onClick={() => daySignups.length > 0 && setSelectedDate(date)}
                    >
                      <div className="text-center mb-2">
                        <div className="text-xs text-muted-foreground font-medium">
                          {format(date, "EEE")}
                        </div>
                        <div className="text-sm font-semibold">
                          {format(date, "MMM d")}
                        </div>
                        {isClosed && (
                          <div className="flex items-center justify-center gap-1 text-xs text-destructive mt-1">
                            <Lock className="w-3 h-3" />
                            Closed
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Badge
                          variant={daySignups.length > 0 ? "default" : "secondary"}
                          className="flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" />
                          {totalPeople}
                        </Badge>
                      </div>

                      {daySignups.length > 0 && (
                        <div className="space-y-1 text-xs">
                          {dietaryCounts.glutenFree > 0 && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Wheat className="w-3 h-3" />
                              <span>{dietaryCounts.glutenFree} GF</span>
                            </div>
                          )}
                          {dietaryCounts.lactoseFree > 0 && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Milk className="w-3 h-3" />
                              <span>{dietaryCounts.lactoseFree} LF</span>
                            </div>
                          )}
                          {dietaryCounts.vegetarian > 0 && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Leaf className="w-3 h-3" />
                              <span>{dietaryCounts.vegetarian} V</span>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Manage Closed Dates - Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Manage Closed Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side - Calendar */}
            <div>
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
                Click any date to lock/unlock it. Locked dates prevent lunch signups.
              </p>
            </div>

            {/* Right side - List of closed dates */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
                      Reopen
                    </Button>
                  </div>
                ))}
              {closedDates.filter((cd) => new Date(cd.date) >= new Date(format(new Date(), "yyyy-MM-dd"))).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No upcoming closed dates</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Drawer open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
            </DrawerTitle>
            <DrawerDescription>
              {selectedDate && `${getTotalPeopleForDate(selectedDate)} total people (${getSignupsForDate(selectedDate).length} signups)`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-8 max-h-[60vh] overflow-y-auto">
            {selectedDate && getSignupsForDate(selectedDate).map((signup) => {
              const signupGuests = guests.filter(g => g.signup_id === signup.id);
              const dietaryInfo = [];
              if (signup.profiles.is_gluten_free) dietaryInfo.push("GF");
              if (signup.profiles.is_lactose_free) dietaryInfo.push("LF");
              if (signup.profiles.is_vegetarian) dietaryInfo.push("V");
              
              return (
                <div key={signup.id} className="py-3 border-b last:border-0">
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {signup.profiles.full_name || signup.profiles.email}
                      {signup.guest_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{signup.guest_count} guest{signup.guest_count > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    {dietaryInfo.length > 0 && (
                      <div className="flex gap-2 mt-1">
                        {signup.profiles.is_gluten_free && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Wheat className="w-3 h-3" />
                            Gluten Free
                          </Badge>
                        )}
                        {signup.profiles.is_lactose_free && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Milk className="w-3 h-3" />
                            Lactose Free
                          </Badge>
                        )}
                        {signup.profiles.is_vegetarian && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Leaf className="w-3 h-3" />
                            Vegetarian
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
                          
                          if (guestDietary.length === 0) return null;
                          
                          return (
                            <div key={guest.id} className="flex gap-2 items-center">
                              <span className="text-xs text-muted-foreground">Guest {index + 1}:</span>
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
                          );
                        })}
                      </div>
                    )}
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
            <DialogTitle>Close Date</DialogTitle>
            <DialogDescription>
              {reasonDialogDate && format(reasonDialogDate, "EEEE, MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Reason (optional)"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReasonDialogDate(null)}>
                Cancel
              </Button>
              <Button onClick={addClosedDateWithReason}>
                Close Date
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
