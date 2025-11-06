import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek, getWeek } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed, Users, Wheat, Milk, Leaf } from "lucide-react";

interface LunchSignup {
  id: string;
  user_id: string;
  lunch_date: string;
  profiles: {
    full_name: string | null;
    email: string;
    is_gluten_free: boolean;
    is_lactose_free: boolean;
    is_vegetarian: boolean;
  };
}

export const KitchenView = () => {
  const [signups, setSignups] = useState<LunchSignup[]>([]);

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

  useEffect(() => {
    fetchSignups();

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getSignupsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return signups.filter((s) => s.lunch_date === dateStr);
  };

  const isPastDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return dateStr < todayStr;
  };

  const getDietaryCounts = (daySignups: LunchSignup[]) => {
    return {
      glutenFree: daySignups.filter(s => s.profiles.is_gluten_free).length,
      lactoseFree: daySignups.filter(s => s.profiles.is_lactose_free).length,
      vegetarian: daySignups.filter(s => s.profiles.is_vegetarian).length,
    };
  };

  return (
    <div className="space-y-4">
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
                  const isPast = isPastDate(date);
                  const dietaryCounts = getDietaryCounts(daySignups);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`border rounded-lg p-3 ${isPast ? "opacity-60 bg-muted/50" : "bg-card"}`}
                    >
                      <div className="text-center mb-2">
                        <div className="text-xs text-muted-foreground font-medium">
                          {format(date, "EEE")}
                        </div>
                        <div className="text-sm font-semibold">
                          {format(date, "MMM d")}
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-1 mb-2">
                        <Badge
                          variant={daySignups.length > 0 ? "default" : "secondary"}
                          className="flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" />
                          {daySignups.length}
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

                      {daySignups.length > 0 && (
                        <div className="mt-2 pt-2 border-t space-y-1">
                          {daySignups.map((signup) => (
                            <div
                              key={signup.id}
                              className="text-xs truncate"
                              title={signup.profiles.full_name || signup.profiles.email}
                            >
                              {signup.profiles.full_name || signup.profiles.email}
                            </div>
                          ))}
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
    </div>
  );
};
