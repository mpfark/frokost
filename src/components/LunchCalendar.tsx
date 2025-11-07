import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek, getWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserPlus, Plus, Minus } from "lucide-react";

interface LunchSignup {
  id: string;
  user_id: string;
  lunch_date: string;
  guest_count: number;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface ClosedDate {
  id: string;
  date: string;
  reason: string | null;
}

export const LunchCalendar = ({ userId }: { userId: string }) => {
  const [signups, setSignups] = useState<LunchSignup[]>([]);
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      .select("*, profiles(full_name, email)")
      .gte("lunch_date", format(startDate, "yyyy-MM-dd"))
      .lte("lunch_date", format(addDays(startDate, 20), "yyyy-MM-dd"));

    if (error) {
      toast.error("Failed to load signups");
      return;
    }

    setSignups(data || []);
  };

  const getUserSignup = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return signups.find((s) => s.lunch_date === dateStr && s.user_id === userId);
  };

  const fetchClosedDates = async () => {
    const { data, error } = await supabase
      .from("closed_dates")
      .select("*")
      .gte("date", format(startDate, "yyyy-MM-dd"))
      .lte("date", format(addDays(startDate, 20), "yyyy-MM-dd"));

    if (error) {
      toast.error("Failed to load closed dates");
      return;
    }

    setClosedDates(data || []);
  };

  useEffect(() => {
    fetchSignups();
    fetchClosedDates();

    const signupsChannel = supabase
      .channel("lunch_signups_changes")
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
      .channel("closed_dates_changes")
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

    return () => {
      supabase.removeChannel(signupsChannel);
      supabase.removeChannel(closedDatesChannel);
    };
  }, []);

  const isSignedUp = (date: Date) => {
    return getUserSignup(date) !== undefined;
  };

  const getSignupsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return signups.filter((s) => s.lunch_date === dateStr);
  };

  const getTotalPeopleForDate = (date: Date) => {
    const daySignups = getSignupsForDate(date);
    return daySignups.length + daySignups.reduce((sum, s) => sum + s.guest_count, 0);
  };

  const toggleSignup = async (date: Date) => {
    const userSignup = getUserSignup(date);
    setIsLoading(true);
    
    try {
      if (userSignup) {
        // Cancel signup
        const { error } = await supabase
          .from("lunch_signups")
          .delete()
          .eq("id", userSignup.id);

        if (error) throw error;
        toast.success("Cancelled lunch signup");
      } else {
        // Sign up with 0 guests initially
        const dateStr = format(date, "yyyy-MM-dd");
        const { error } = await supabase
          .from("lunch_signups")
          .insert({ 
            user_id: userId, 
            lunch_date: dateStr,
            guest_count: 0
          });

        if (error) throw error;
        toast.success("Signed up for lunch!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateGuestCount = async (date: Date, delta: number) => {
    const userSignup = getUserSignup(date);
    if (!userSignup) return;

    const newCount = Math.max(0, Math.min(10, userSignup.guest_count + delta));
    if (newCount === userSignup.guest_count) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("lunch_signups")
        .update({ guest_count: newCount })
        .eq("id", userSignup.id);

      if (error) throw error;
      
      if (newCount === 0) {
        toast.success("Removed all guests");
      } else {
        toast.success(`Updated to ${newCount} guest${newCount > 1 ? 's' : ''}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isPastDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return dateStr < todayStr;
  };

  const isDateClosed = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return closedDates.some((cd) => cd.date === dateStr);
  };

  const getClosedReason = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return closedDates.find((cd) => cd.date === dateStr)?.reason;
  };

  return (
    <div className="space-y-4">
      {weeks.map(({ weekNumber, days }) => (
        <Card key={weekNumber}>
          <CardContent className="p-6">
            <div className="flex gap-4">
              {/* Week Number */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center bg-muted rounded-lg px-4 py-2 min-w-[80px]">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Week</div>
                <div className="text-4xl font-bold text-foreground">{weekNumber}</div>
              </div>

              {/* Days Grid */}
              <div className="flex-1 grid grid-cols-5 gap-3">
                {days.map((date) => {
                  const signedUp = isSignedUp(date);
                  const userSignup = getUserSignup(date);
                  const totalPeople = getTotalPeopleForDate(date);
                  const totalGuests = getSignupsForDate(date).reduce((sum, s) => sum + s.guest_count, 0);
                  const isPast = isPastDate(date);
                  const isClosed = isDateClosed(date);
                  const closedReason = getClosedReason(date);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`border rounded-lg p-3 flex flex-col gap-2 ${isPast || isClosed ? "opacity-60 bg-muted/50" : "bg-card"}`}
                    >
                      {/* Top Row: Date and Stats */}
                      <div className="flex justify-between items-start">
                        {/* Left: Day and Date */}
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">
                            {format(date, "EEE")}
                          </div>
                          <div className="text-sm font-semibold">
                            {format(date, "MMM d")}
                          </div>
                          {isClosed && (
                            <div className="text-xs text-destructive font-medium mt-1">
                              Closed
                            </div>
                          )}
                        </div>

                        {/* Right: People Count */}
                        {!isClosed && (
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-xs font-medium">
                              <Users className="w-3 h-3" />
                              <span>{totalPeople}</span>
                            </div>
                            {totalGuests > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {totalGuests} guest{totalGuests > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Signup Button and Guest Controls */}
                      <div className="flex gap-2 mt-auto">
                        {/* Signup Button - Half Width */}
                        <Button
                          onClick={() => toggleSignup(date)}
                          disabled={isLoading || isPast || isClosed}
                          variant={signedUp ? "default" : "outline"}
                          size="sm"
                          className="flex-1 h-9 text-xs"
                          title={isClosed ? closedReason || "Office closed" : ""}
                        >
                          {signedUp ? "Signed Up" : isPast || isClosed ? "Closed" : "Sign Up"}
                        </Button>

                        {/* Guest Controls - Only show when signed up */}
                        {signedUp && !isPast && !isClosed && userSignup && (
                          <div className="flex flex-col gap-1">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateGuestCount(date, 1);
                              }}
                              disabled={isLoading || (userSignup.guest_count >= 10)}
                              variant="outline"
                              size="sm"
                              className="h-4 w-8 p-0"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            {userSignup.guest_count > 0 && (
                              <div className="text-xs text-center font-medium">
                                +{userSignup.guest_count}
                              </div>
                            )}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateGuestCount(date, -1);
                              }}
                              disabled={isLoading || userSignup.guest_count === 0}
                              variant="outline"
                              size="sm"
                              className="h-4 w-8 p-0"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
