import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInBusinessDays, eachDayOfInterval, isWeekend } from "date-fns";
import { Users, Calendar, UserPlus, TrendingUp, UserX, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatisticsOverviewProps {
  startDate: Date;
  endDate: Date;
}

interface Stats {
  totalSignups: number;
  uniqueUsers: number;
  totalGuests: number;
  avgPerDay: number;
  totalOptouts: number;
  absentCount: number;
  attendanceRate: number;
  totalActiveProfiles: number;
}

export const StatisticsOverview = ({ startDate, endDate }: StatisticsOverviewProps) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const [signupsRes, guestsRes, optoutsRes, activeProfilesRes, excludedProfilesRes] = await Promise.all([
        supabase
          .from("lunch_signups")
          .select("id, user_id, lunch_date, guest_count, marked_absent_at")
          .gte("lunch_date", startStr)
          .lte("lunch_date", endStr),
        supabase
          .from("guests")
          .select("id, signup_id, lunch_signups!inner(lunch_date)")
          .gte("lunch_signups.lunch_date", startStr)
          .lte("lunch_signups.lunch_date", endStr),
        supabase
          .from("lunch_optouts")
          .select("id")
          .gte("lunch_date", startStr)
          .lte("lunch_date", endStr),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("reminder_enabled", true),
        supabase
          .from("profiles")
          .select("id")
          .eq("is_active", true)
          .eq("reminder_enabled", false),
      ]);

      // Build excluded user set (reminder_enabled = false)
      const excludedUserIds = new Set((excludedProfilesRes.data || []).map(p => p.id));

      const signups = (signupsRes.data || []).filter(s => !excludedUserIds.has(s.user_id));
      const guests = guestsRes.data || [];
      const optouts = optoutsRes.data || [];

      const uniqueUserIds = new Set(signups.map((s) => s.user_id));
      
      // Calculate business days in range
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      const businessDays = allDays.filter((d) => !isWeekend(d)).length;
      
      const avgPerDay = businessDays > 0 ? signups.length / businessDays : 0;

      // Calculate absence stats
      const absentCount = signups.filter((s) => s.marked_absent_at).length;
      const attendanceRate = signups.length > 0 
        ? ((signups.length - absentCount) / signups.length) * 100 
        : 100;

      setStats({
        totalSignups: signups.length,
        uniqueUsers: uniqueUserIds.size,
        totalGuests: guests.length,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        totalOptouts: optouts.length,
        absentCount,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        totalActiveProfiles: activeProfilesRes.count || 0,
      });
      setLoading(false);
    };

    fetchStats();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[...Array(7)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Brugere i systemet</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalActiveProfiles}</div>
          <p className="text-xs text-muted-foreground">
            Aktive brugere (ekskl. uden påmindelser)
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tilmeldinger</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalSignups}</div>
          <p className="text-xs text-muted-foreground">
            I den valgte periode
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gns. pr. dag</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.avgPerDay}</div>
          <p className="text-xs text-muted-foreground">
            Hverdage i perioden
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Brugere med tilmeldinger</CardTitle>
          <UserPlus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
          <p className="text-xs text-muted-foreground">
            Har været tilmeldt mindst én gang
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gæster</CardTitle>
          <UserPlus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalGuests}</div>
          <p className="text-xs text-muted-foreground">
            {stats.totalOptouts} afmeldinger i perioden
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fravær</CardTitle>
          <UserX className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.absentCount}</div>
          <p className="text-xs text-muted-foreground">
            Markeret fraværende
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fremmøde</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.attendanceRate}%</div>
          <p className="text-xs text-muted-foreground">
            Af tilmeldte mødte op
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
