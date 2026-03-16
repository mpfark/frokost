import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, isWeekend } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserActivityTableProps {
  startDate: Date;
  endDate: Date;
}

interface UserActivity {
  userId: string;
  name: string;
  email: string;
  signupCount: number;
  guestCount: number;
  attendancePercent: number;
}

export const UserActivityTable = ({ startDate, endDate }: UserActivityTableProps) => {
  const [topUsers, setTopUsers] = useState<UserActivity[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // Calculate business days
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      const businessDays = allDays.filter((d) => !isWeekend(d)).length;

      const [profilesRes, signupsRes, guestsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, reminder_enabled").eq("is_active", true),
        supabase
          .from("lunch_signups")
          .select("user_id, guest_count")
          .gte("lunch_date", startStr)
          .lte("lunch_date", endStr),
        supabase
          .from("guests")
          .select("id, signup_id, lunch_signups!inner(user_id, lunch_date)")
          .gte("lunch_signups.lunch_date", startStr)
          .lte("lunch_signups.lunch_date", endStr),
      ]);

      const profiles = profilesRes.data || [];
      const signups = signupsRes.data || [];
      const guests = guestsRes.data || [];

      // Filter out users with reminder_enabled = false for statistics
      const statsProfiles = profiles.filter((p: any) => p.reminder_enabled !== false);

      // Count signups and guests per user
      const userStats: Record<string, { signupCount: number; guestCount: number }> = {};

      signups.forEach((s) => {
        if (!userStats[s.user_id]) {
          userStats[s.user_id] = { signupCount: 0, guestCount: 0 };
        }
        userStats[s.user_id].signupCount++;
      });

      guests.forEach((g: any) => {
        const userId = g.lunch_signups.user_id;
        if (!userStats[userId]) {
          userStats[userId] = { signupCount: 0, guestCount: 0 };
        }
        userStats[userId].guestCount++;
      });

      // Build top users list (only from users with reminders enabled)
      const userActivities: UserActivity[] = statsProfiles
        .filter((p: any) => userStats[p.id])
        .map((p: any) => ({
          userId: p.id,
          name: p.full_name || "Ukendt",
          email: p.email,
          signupCount: userStats[p.id].signupCount,
          guestCount: userStats[p.id].guestCount,
          attendancePercent: businessDays > 0 ? Math.round((userStats[p.id].signupCount / businessDays) * 100) : 0,
        }))
        .sort((a: UserActivity, b: UserActivity) => b.signupCount - a.signupCount);

      setTopUsers(userActivities.slice(0, 10));

      // Find inactive users (only from users with reminders enabled)
      const usersWithSignups = new Set(Object.keys(userStats));
      const inactive = statsProfiles
        .filter((p: any) => !usersWithSignups.has(p.id))
        .map((p: any) => ({
          id: p.id,
          name: p.full_name || "Ukendt",
          email: p.email,
        }));
      setInactiveUsers(inactive);

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
        <CardTitle>Brugeraktivitet</CardTitle>
        <CardDescription>Oversigt over brugerdeltagelse i perioden</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="top">
          <TabsList>
            <TabsTrigger value="top">Top 10 aktive</TabsTrigger>
            <TabsTrigger value="inactive">
              Uden tilmeldinger ({inactiveUsers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="top" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bruger</TableHead>
                  <TableHead className="text-right">Tilmeldinger</TableHead>
                  <TableHead className="text-right">Gæster</TableHead>
                  <TableHead className="text-right">Fremmøde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUsers.map((user, index) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-4">{index + 1}.</span>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{user.signupCount}</TableCell>
                    <TableCell className="text-right">{user.guestCount}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={user.attendancePercent >= 80 ? "default" : user.attendancePercent >= 50 ? "secondary" : "outline"}>
                        {user.attendancePercent}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {topUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Ingen tilmeldinger i perioden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="inactive" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Aktive brugere som ikke har tilmeldt sig frokost i den valgte periode.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bruger</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  </TableRow>
                ))}
                {inactiveUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      Alle brugere har været tilmeldt i perioden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
