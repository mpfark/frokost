import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const dates = Array.from({ length: 21 }, (_, i) => addDays(startDate, i));

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
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
      {dates.map((date) => {
        const signedUp = isSignedUp(date);
        const daySignups = getSignupsForDate(date);
        const isPast = isPastDate(date);

        return (
          <Card
            key={date.toISOString()}
            className={`transition-all ${
              signedUp ? "ring-2 ring-primary" : ""
            } ${isPast ? "opacity-60" : ""}`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{format(date, "EEE, MMM d")}</span>
                {daySignups.length > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {daySignups.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => toggleSignup(date)}
                disabled={isLoading || isPast}
                variant={signedUp ? "default" : "outline"}
                className="w-full"
                size="sm"
              >
                {signedUp ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Signed Up
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    {isPast ? "Past Date" : "Sign Up"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
