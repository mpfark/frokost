import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek, isWeekend, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SignupChartProps {
  startDate: Date;
  endDate: Date;
}

type ViewType = "daily" | "weekly";

interface ChartData {
  date: string;
  label: string;
  signups: number;
  guests: number;
}

export const SignupChart = ({ startDate, endDate }: SignupChartProps) => {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<ViewType>("daily");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const [signupsRes, guestsRes] = await Promise.all([
        supabase
          .from("lunch_signups")
          .select("lunch_date, guest_count")
          .gte("lunch_date", startStr)
          .lte("lunch_date", endStr),
        supabase
          .from("guests")
          .select("id, lunch_signups!inner(lunch_date)")
          .gte("lunch_signups.lunch_date", startStr)
          .lte("lunch_signups.lunch_date", endStr),
      ]);

      const signups = signupsRes.data || [];
      const guests = guestsRes.data || [];

      // Count signups per date
      const signupsByDate: Record<string, number> = {};
      const guestsByDate: Record<string, number> = {};

      signups.forEach((s) => {
        signupsByDate[s.lunch_date] = (signupsByDate[s.lunch_date] || 0) + 1;
      });

      guests.forEach((g: any) => {
        const date = g.lunch_signups.lunch_date;
        guestsByDate[date] = (guestsByDate[date] || 0) + 1;
      });

      let chartData: ChartData[];

      if (viewType === "daily") {
        const days = eachDayOfInterval({ start: startDate, end: endDate }).filter(
          (d) => !isWeekend(d)
        );
        chartData = days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          return {
            date: dateStr,
            label: format(day, "d/M", { locale: da }),
            signups: signupsByDate[dateStr] || 0,
            guests: guestsByDate[dateStr] || 0,
          };
        });
      } else {
        const weeks = eachWeekOfInterval(
          { start: startDate, end: endDate },
          { weekStartsOn: 1 }
        );
        chartData = weeks.map((weekStart) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          let weekSignups = 0;
          let weekGuests = 0;

          eachDayOfInterval({ start: weekStart, end: weekEnd }).forEach((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            weekSignups += signupsByDate[dateStr] || 0;
            weekGuests += guestsByDate[dateStr] || 0;
          });

          return {
            date: format(weekStart, "yyyy-MM-dd"),
            label: `Uge ${format(weekStart, "w", { locale: da })}`,
            signups: weekSignups,
            guests: weekGuests,
          };
        });
      }

      setData(chartData);
      setLoading(false);
    };

    fetchData();
  }, [startDate, endDate, viewType]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tilmeldinger over tid</CardTitle>
          <CardDescription>
            Antal tilmeldinger og gæster pr. {viewType === "daily" ? "dag" : "uge"}
          </CardDescription>
        </div>
        <Select value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daglig</SelectItem>
            <SelectItem value="weekly">Ugentlig</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="signups"
                name="Tilmeldinger"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="guests"
                name="Gæster"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
