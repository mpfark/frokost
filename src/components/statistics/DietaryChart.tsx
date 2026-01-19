import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface DietaryChartProps {
  startDate: Date;
  endDate: Date;
}

interface DietaryData {
  name: string;
  value: number;
  color: string;
}

export const DietaryChart = ({ startDate, endDate }: DietaryChartProps) => {
  const [data, setData] = useState<DietaryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalParticipants, setTotalParticipants] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // Get unique users who signed up in period with their dietary info
      const { data: signups } = await supabase
        .from("lunch_signups")
        .select("user_id, profiles(is_gluten_free, is_lactose_free, is_vegetarian)")
        .gte("lunch_date", startStr)
        .lte("lunch_date", endStr);

      // Get guests with dietary info
      const { data: guests } = await supabase
        .from("guests")
        .select("is_gluten_free, is_lactose_free, is_vegetarian, lunch_signups!inner(lunch_date)")
        .gte("lunch_signups.lunch_date", startStr)
        .lte("lunch_signups.lunch_date", endStr);

      if (!signups) {
        setLoading(false);
        return;
      }

      let glutenFree = 0;
      let lactoseFree = 0;
      let vegetarian = 0;
      let regular = 0;

      // Count unique user dietary preferences
      const seenUsers = new Set<string>();
      signups.forEach((s: any) => {
        if (!seenUsers.has(s.user_id)) {
          seenUsers.add(s.user_id);
          const profile = s.profiles;
          if (profile) {
            const hasRestriction = profile.is_gluten_free || profile.is_lactose_free || profile.is_vegetarian;
            if (profile.is_gluten_free) glutenFree++;
            if (profile.is_lactose_free) lactoseFree++;
            if (profile.is_vegetarian) vegetarian++;
            if (!hasRestriction) regular++;
          }
        }
      });

      // Add guest dietary info
      (guests || []).forEach((g: any) => {
        const hasRestriction = g.is_gluten_free || g.is_lactose_free || g.is_vegetarian;
        if (g.is_gluten_free) glutenFree++;
        if (g.is_lactose_free) lactoseFree++;
        if (g.is_vegetarian) vegetarian++;
        if (!hasRestriction) regular++;
      });

      const total = seenUsers.size + (guests?.length || 0);
      setTotalParticipants(total);

      const chartData: DietaryData[] = [
        { name: "Glutenfri", value: glutenFree, color: "hsl(var(--chart-1))" },
        { name: "Laktosefri", value: lactoseFree, color: "hsl(var(--chart-2))" },
        { name: "Vegetar", value: vegetarian, color: "hsl(var(--chart-3))" },
        { name: "Ingen restriktioner", value: regular, color: "hsl(var(--chart-4))" },
      ].filter((d) => d.value > 0);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kostrestriktioner</CardTitle>
        <CardDescription>Fordeling af kostrestriktioner blandt deltagere ({totalParticipants} unikke)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number) => [`${value} personer`, ""]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
