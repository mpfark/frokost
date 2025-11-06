import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed, Users } from "lucide-react";

interface LunchSignup {
  id: string;
  user_id: string;
  lunch_date: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

export const KitchenView = () => {
  const [signups, setSignups] = useState<LunchSignup[]>([]);

  const today = new Date();
  const startDate = startOfWeek(today, { weekStartsOn: 1 });
  const dates = Array.from({ length: 21 }, (_, i) => addDays(startDate, i));

  const fetchSignups = async () => {
    const { data, error } = await supabase
      .from("lunch_signups")
      .select("*, profiles(full_name, email)")
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

      <div className="grid gap-4">
        {dates.map((date) => {
          const daySignups = getSignupsForDate(date);
          const isPast = isPastDate(date);

          return (
            <Card
              key={date.toISOString()}
              className={isPast ? "opacity-60" : ""}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg">{format(date, "EEEE, MMMM d, yyyy")}</span>
                  <Badge
                    variant={daySignups.length > 0 ? "default" : "secondary"}
                    className="flex items-center gap-1"
                  >
                    <Users className="w-4 h-4" />
                    {daySignups.length} {daySignups.length === 1 ? "person" : "people"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {daySignups.length > 0 ? (
                  <ul className="space-y-2">
                    {daySignups.map((signup) => (
                      <li
                        key={signup.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div className="w-2 h-2 bg-primary rounded-full" />
                        <span className="font-medium">
                          {signup.profiles.full_name || signup.profiles.email}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No signups yet
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
