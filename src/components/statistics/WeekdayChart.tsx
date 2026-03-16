import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, getDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface WeekdayChartProps {
  startDate: Date;
  endDate: Date;
}

interface WeekdayData {
  day: string;
  dayIndex: number;
  signupAvg: number;
  optoutAvg: number;
  responseRate: number;
  signupTotal: number;
  optoutTotal: number;
  uniqueDays: number;
}

const WEEKDAY_NAMES = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

export const WeekdayChart = ({ startDate, endDate }: WeekdayChartProps) => {
  const [data, setData] = useState<WeekdayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgResponseRate, setAvgResponseRate] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // Fetch signups, optouts, and profiles with reminder_enabled in parallel
      const [signupsRes, optoutsRes, profilesRes] = await Promise.all([
        supabase
          .from("lunch_signups")
          .select("lunch_date, user_id")
          .gte("lunch_date", startStr)
          .lte("lunch_date", endStr),
        supabase
          .from("lunch_optouts")
          .select("lunch_date, user_id")
          .gte("lunch_date", startStr)
          .lte("lunch_date", endStr),
        supabase
          .from("profiles")
          .select("id, reminder_enabled")
          .eq("is_active", true),
      ]);

      const signups = signupsRes.data || [];
      const optouts = optoutsRes.data || [];

      // Build set of users excluded from statistics (reminder_enabled = false)
      const excludedUserIds = new Set(
        (profilesRes.data || []).filter(p => !p.reminder_enabled).map(p => p.id)
      );

      // Build optout map: date -> set of user_ids with optout on that date
      const optoutsByDate = new Map<string, Set<string>>();
      optouts.forEach((o) => {
        if (excludedUserIds.has(o.user_id)) return;
        if (!optoutsByDate.has(o.lunch_date)) {
          optoutsByDate.set(o.lunch_date, new Set());
        }
        optoutsByDate.get(o.lunch_date)!.add(o.user_id);
      });

      // Find all unique user_ids from signups + optouts in the period (excluding opted-out users)
      const usersWithActivity = new Set<string>();
      signups.forEach((s) => { if (!excludedUserIds.has(s.user_id)) usersWithActivity.add(s.user_id); });
      optouts.forEach((o) => { if (!excludedUserIds.has(o.user_id)) usersWithActivity.add(o.user_id); });
      
      const activeUserCount = usersWithActivity.size || 1;

      // Group by weekday
      type WeekdayStats = {
        signups: number;
        optouts: number;
        dates: Set<string>;
        usersWithChoice: Map<string, Set<string>>; // date -> set of user_ids
      };

      const weekdayStats: Record<number, WeekdayStats> = {};

      // Initialize weekdays 1-5 (Monday to Friday)
      for (let i = 1; i <= 5; i++) {
        weekdayStats[i] = { signups: 0, optouts: 0, dates: new Set(), usersWithChoice: new Map() };
      }

      // Process signups (exclude users with reminder_enabled = false)
      signups.forEach((s) => {
        if (excludedUserIds.has(s.user_id)) return;
        const date = parseISO(s.lunch_date);
        const dayIndex = getDay(date);
        if (dayIndex >= 1 && dayIndex <= 5) {
          weekdayStats[dayIndex].signups++;
          weekdayStats[dayIndex].dates.add(s.lunch_date);

          if (!weekdayStats[dayIndex].usersWithChoice.has(s.lunch_date)) {
            weekdayStats[dayIndex].usersWithChoice.set(s.lunch_date, new Set());
          }
          weekdayStats[dayIndex].usersWithChoice.get(s.lunch_date)!.add(s.user_id);
        }
      });

      // Process optouts (exclude users with reminder_enabled = false)
      optouts.forEach((o) => {
        if (excludedUserIds.has(o.user_id)) return;
        const date = parseISO(o.lunch_date);
        const dayIndex = getDay(date);
        if (dayIndex >= 1 && dayIndex <= 5) {
          weekdayStats[dayIndex].optouts++;
          weekdayStats[dayIndex].dates.add(o.lunch_date);

          if (!weekdayStats[dayIndex].usersWithChoice.has(o.lunch_date)) {
            weekdayStats[dayIndex].usersWithChoice.set(o.lunch_date, new Set());
          }
          weekdayStats[dayIndex].usersWithChoice.get(o.lunch_date)!.add(o.user_id);
        }
      });

      // Calculate averages and response rates
      const chartData: WeekdayData[] = [];
      let totalResponseRate = 0;
      let daysWithData = 0;

      for (let i = 1; i <= 5; i++) {
        const stats = weekdayStats[i];
        const uniqueDays = stats.dates.size || 1;

        // Calculate average response rate for this weekday, adjusting population per date
        let totalDailyResponseRate = 0;
        stats.usersWithChoice.forEach((users, date) => {
          const absentOnDate = optoutsByDate.get(date)?.size || 0;
          const adjustedPopulation = Math.max(activeUserCount - absentOnDate, 1);
          const dailyRate = (users.size / adjustedPopulation) * 100;
          totalDailyResponseRate += dailyRate;
        });
        const avgResponseRateForDay = stats.dates.size > 0 ? totalDailyResponseRate / stats.dates.size : 0;

        if (stats.dates.size > 0) {
          totalResponseRate += avgResponseRateForDay;
          daysWithData++;
        }

        chartData.push({
          day: WEEKDAY_NAMES[i],
          dayIndex: i,
          signupAvg: Math.round((stats.signups / uniqueDays) * 10) / 10,
          optoutAvg: Math.round((stats.optouts / uniqueDays) * 10) / 10,
          responseRate: Math.round(avgResponseRateForDay),
          signupTotal: stats.signups,
          optoutTotal: stats.optouts,
          uniqueDays,
        });
      }

      setData(chartData);
      setAvgResponseRate(daysWithData > 0 ? Math.round(totalResponseRate / daysWithData) : 0);
      setLoading(false);
    };

    fetchData();
  }, [startDate, endDate]);

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

  const maxResponseRate = Math.max(...data.map((d) => d.responseRate));
  const bestDay = data.find((d) => d.responseRate === maxResponseRate);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ugedagsfordeling & Svarprocent</CardTitle>
        <CardDescription>
          Gennemsnitligt antal tilmeldinger/afmeldinger pr. ugedag med svarprocent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "signupAvg") return [`${value} gns.`, "Tilmeldinger"];
                  if (name === "optoutAvg") return [`${value} gns.`, "Afmeldinger"];
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    const item = payload[0].payload as WeekdayData;
                    return `${label} (${item.responseRate}% har svaret)`;
                  }
                  return label;
                }}
              />
              <Legend
                formatter={(value) => {
                  if (value === "signupAvg") return "Tilmeldinger (gns.)";
                  if (value === "optoutAvg") return "Afmeldinger (gns.)";
                  return value;
                }}
              />
              <Bar dataKey="signupAvg" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="optoutAvg" stackId="a" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs text-muted-foreground">
          {data.map((d) => (
            <div key={d.dayIndex} className="flex flex-col items-center">
              <span
                className={`font-semibold ${
                  d.responseRate === maxResponseRate && maxResponseRate > 0
                    ? "text-primary"
                    : "text-foreground"
                }`}
              >
                {d.responseRate}%
              </span>
              <span>har svaret</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between text-sm text-muted-foreground">
          <span>
            Gennemsnitlig svarprocent: <span className="font-medium text-foreground">{avgResponseRate}%</span>
          </span>
          {bestDay && maxResponseRate > 0 && (
            <span>
              Bedste dag: <span className="font-medium text-foreground">{bestDay.day}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
