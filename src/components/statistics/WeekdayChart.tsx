import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, getDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface WeekdayChartProps {
  startDate: Date;
  endDate: Date;
}

interface WeekdayData {
  day: string;
  dayIndex: number;
  avg: number;
  total: number;
  count: number;
}

const WEEKDAY_NAMES = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

export const WeekdayChart = ({ startDate, endDate }: WeekdayChartProps) => {
  const [data, setData] = useState<WeekdayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const { data: signups } = await supabase
        .from("lunch_signups")
        .select("lunch_date")
        .gte("lunch_date", startStr)
        .lte("lunch_date", endStr);

      if (!signups) {
        setLoading(false);
        return;
      }

      // Group by weekday
      const weekdayStats: Record<number, { total: number; dates: Set<string> }> = {};
      
      // Initialize weekdays 1-5 (Monday to Friday)
      for (let i = 1; i <= 5; i++) {
        weekdayStats[i] = { total: 0, dates: new Set() };
      }

      signups.forEach((s) => {
        const date = parseISO(s.lunch_date);
        const dayIndex = getDay(date);
        if (dayIndex >= 1 && dayIndex <= 5) {
          weekdayStats[dayIndex].total++;
          weekdayStats[dayIndex].dates.add(s.lunch_date);
        }
      });

      // Calculate averages
      const chartData: WeekdayData[] = [];
      for (let i = 1; i <= 5; i++) {
        const stats = weekdayStats[i];
        const uniqueDays = stats.dates.size || 1;
        chartData.push({
          day: WEEKDAY_NAMES[i],
          dayIndex: i,
          avg: Math.round((stats.total / uniqueDays) * 10) / 10,
          total: stats.total,
          count: uniqueDays,
        });
      }

      setData(chartData);
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

  const maxAvg = Math.max(...data.map((d) => d.avg));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ugedagsfordeling</CardTitle>
        <CardDescription>Gennemsnitligt antal tilmeldinger pr. ugedag</CardDescription>
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
                formatter={(value: number, name: string) => [
                  `${value} gns.`,
                  "Tilmeldinger",
                ]}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.avg === maxAvg
                        ? "hsl(var(--primary))"
                        : "hsl(var(--primary) / 0.6)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Mest populær dag: <span className="font-medium text-foreground">{data.find((d) => d.avg === maxAvg)?.day}</span>
        </div>
      </CardContent>
    </Card>
  );
};
