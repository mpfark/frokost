import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek, getWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Users, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [guestDialogDate, setGuestDialogDate] = useState<Date | null>(null);
  const [guestCount, setGuestCount] = useState("0");

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
    
    if (userSignup) {
      // Cancel signup
      setIsLoading(true);
      try {
        const { error } = await supabase
          .from("lunch_signups")
          .delete()
          .eq("id", userSignup.id);

        if (error) throw error;
        toast.success("Cancelled lunch signup");
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Show guest dialog
      setGuestDialogDate(date);
      setGuestCount("0");
    }
  };

  const confirmSignup = async () => {
    if (!guestDialogDate) return;
    
    setIsLoading(true);
    const dateStr = format(guestDialogDate, "yyyy-MM-dd");
    const guests = parseInt(guestCount) || 0;

    try {
      const { error } = await supabase
        .from("lunch_signups")
        .insert({ 
          user_id: userId, 
          lunch_date: dateStr,
          guest_count: guests
        });

      if (error) throw error;
      toast.success(guests > 0 ? `Signed up for lunch with ${guests} guest${guests > 1 ? 's' : ''}!` : "Signed up for lunch!");
      setGuestDialogDate(null);
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
                  const isPast = isPastDate(date);
                  const isClosed = isDateClosed(date);
                  const closedReason = getClosedReason(date);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`flex flex-col gap-2 ${isPast || isClosed ? "opacity-60" : ""}`}
                    >
                      <div className="text-center">
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
                      
                      {totalPeople > 0 && !isClosed && (
                        <Badge variant="secondary" className="flex items-center justify-center gap-1 text-xs">
                          <Users className="w-3 h-3" />
                          {totalPeople}
                        </Badge>
                      )}

                      <Button
                        onClick={() => toggleSignup(date)}
                        disabled={isLoading || isPast || isClosed}
                        variant={signedUp ? "default" : "outline"}
                        size="sm"
                        className="w-full h-8 text-xs gap-1"
                        title={isClosed ? closedReason || "Office closed" : ""}
                      >
                        {signedUp ? (
                          <>
                            <Check className="w-3 h-3" />
                            {userSignup && userSignup.guest_count > 0 && (
                              <span className="text-[10px]">+{userSignup.guest_count}</span>
                            )}
                          </>
                        ) : isPast || isClosed ? (
                          <X className="w-3 h-3" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Guest Count Dialog */}
      <Dialog open={guestDialogDate !== null} onOpenChange={(open) => !open && setGuestDialogDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Up for Lunch</DialogTitle>
            <DialogDescription>
              {guestDialogDate && format(guestDialogDate, "EEEE, MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guests">Number of guests (optional)</Label>
              <Input
                id="guests"
                type="number"
                min="0"
                max="10"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                placeholder="0"
              />
              <p className="text-sm text-muted-foreground">
                How many guests will you bring? (Max 10)
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setGuestDialogDate(null)}>
                Cancel
              </Button>
              <Button onClick={confirmSignup} disabled={isLoading}>
                Confirm Signup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
