import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditLogEntry {
  id: string;
  created_at: string;
  user_id: string;
  action: string;
  lunch_date: string;
  details: any;
  userName?: string;
}

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  signup_created: { label: "Tilmeldt", variant: "default" },
  signup_deleted: { label: "Afmeldt", variant: "destructive" },
  optout_created: { label: "Fravalgt", variant: "secondary" },
  optout_deleted: { label: "Fravalg fjernet", variant: "outline" },
  guest_added: { label: "Gæst tilføjet", variant: "default" },
  guest_removed: { label: "Gæst fjernet", variant: "destructive" },
  marked_absent: { label: "Markeret fraværende", variant: "secondary" },
  unmarked_absent: { label: "Fravær fjernet", variant: "outline" },
};

export const AuditLogTable = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchLogs = async () => {
    setLoading(true);

    let query = supabase
      .from("signup_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter !== "all") {
      query = query.eq("action", filter);
    }

    const { data: auditLogs } = await query;

    if (!auditLogs) {
      setLogs([]);
      setLoading(false);
      return;
    }

    // Get user names
    const userIds = [...new Set(auditLogs.map((l) => l.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name || p.email]) || []);

    const logsWithNames = auditLogs.map((log) => ({
      ...log,
      userName: profileMap.get(log.user_id) || "Ukendt",
    }));

    setLogs(logsWithNames);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Aktivitetslog</CardTitle>
          <CardDescription>Seneste ændringer i tilmeldinger</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle handlinger</SelectItem>
              <SelectItem value="signup_created">Tilmeldinger</SelectItem>
              <SelectItem value="signup_deleted">Afmeldinger</SelectItem>
              <SelectItem value="optout_created">Fravalg</SelectItem>
              <SelectItem value="guest_added">Gæster tilføjet</SelectItem>
              <SelectItem value="guest_removed">Gæster fjernet</SelectItem>
              <SelectItem value="marked_absent">Markeret fraværende</SelectItem>
              <SelectItem value="unmarked_absent">Fravær fjernet</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tidspunkt</TableHead>
              <TableHead>Bruger</TableHead>
              <TableHead>Handling</TableHead>
              <TableHead>Dato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const actionInfo = ACTION_LABELS[log.action] || { label: log.action, variant: "outline" as const };
              return (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {format(parseISO(log.created_at), "d. MMM HH:mm", { locale: da })}
                  </TableCell>
                  <TableCell className="font-medium">{log.userName}</TableCell>
                  <TableCell>
                    <Badge variant={actionInfo.variant}>{actionInfo.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {format(parseISO(log.lunch_date), "EEEE d. MMMM", { locale: da })}
                  </TableCell>
                </TableRow>
              );
            })}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Ingen aktivitet registreret endnu
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
