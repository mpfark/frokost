import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek, getWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Users } from "lucide-react";

interface LunchSignup {
  id: string;
  user_id: string;
  lunch_date: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

export const LunchCalendar = ({ userId }: { userId: string }) => {
  const [signups, setSignups] = useState<LunchSignup[]>([]);
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

  useEffect(() => {
    fetchSignups();

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isSignedUp = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return signups.some((s) => s.lunch_date === dateStr && s.user_id === userId);
  };

  const getSignupsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return signups.filter((s) => s.lunch_date === dateStr);
  };

  const toggleSignup = async (date: Date) => {
    setIsLoading(true);
    const dateStr = format(date, "yyyy-MM-dd");

    try {
      if (isSignedUp(date)) {
        const { error } = await supabase
          .from("lunch_signups")
          .delete()
          .eq("user_id", userId)
          .eq("lunch_date", dateStr);

        if (error) throw error;
        toast.success("Cancelled lunch signup");
      } else {
        const { error } = await supabase
          .from("lunch_signups")
          .insert({ user_id: userId, lunch_date: dateStr });

        if (error) throw error;
        toast.success("Signed up for lunch!");
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
                  const daySignups = getSignupsForDate(date);
                  const isPast = isPastDate(date);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`flex flex-col gap-2 ${isPast ? "opacity-60" : ""}`}
                    >
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground font-medium">
                          {format(date, "EEE")}
                        </div>
                        <div className="text-sm font-semibold">
                          {format(date, "MMM d")}
                        </div>
                      </div>
                      
                      {daySignups.length > 0 && (
                        <Badge variant="secondary" className="flex items-center justify-center gap-1 text-xs">
                          <Users className="w-3 h-3" />
                          {daySignups.length}
                        </Badge>
                      )}

                      <Button
                        onClick={() => toggleSignup(date)}
                        disabled={isLoading || isPast}
                        variant={signedUp ? "default" : "outline"}
                        size="sm"
                        className="w-full h-8 text-xs"
                      >
                        {signedUp ? (
                          <Check className="w-3 h-3" />
                        ) : isPast ? (
                          <X className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
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
    </div>
  );
};
