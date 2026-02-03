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
  // Combined actions
  changed_to_optout: { label: "Ændret til fravalg", variant: "secondary" },
  changed_to_signup: { label: "Ændret til tilmelding", variant: "default" },
};

// Combine related actions that happen within 1 minute
const combineRelatedActions = (logs: AuditLogEntry[]): AuditLogEntry[] => {
  const result: AuditLogEntry[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < logs.length; i++) {
    if (usedIndices.has(i)) continue;

    const current = logs[i];
    let combined = false;

    // Look for a matching pair within adjacent entries
    for (let j = i + 1; j < logs.length; j++) {
      if (usedIndices.has(j)) continue;

      const other = logs[j];

      // Must be same user and same lunch date
      if (current.user_id !== other.user_id || current.lunch_date !== other.lunch_date) continue;

      // Check if within 1 minute of each other
      const currentTime = new Date(current.created_at).getTime();
      const otherTime = new Date(other.created_at).getTime();
      const diffMs = Math.abs(currentTime - otherTime);
      
      if (diffMs > 60000) continue; // More than 1 minute apart

      // Check for signup_deleted + optout_created combination
      if (
        (current.action === "signup_deleted" && other.action === "optout_created") ||
        (current.action === "optout_created" && other.action === "signup_deleted")
      ) {
        // Use the later timestamp
        const laterEntry = currentTime > otherTime ? current : other;
        result.push({
          ...laterEntry,
          action: "changed_to_optout",
        });
        usedIndices.add(i);
        usedIndices.add(j);
        combined = true;
        break;
      }

      // Check for optout_deleted + signup_created combination
      if (
        (current.action === "optout_deleted" && other.action === "signup_created") ||
        (current.action === "signup_created" && other.action === "optout_deleted")
      ) {
        // Use the later timestamp
        const laterEntry = currentTime > otherTime ? current : other;
        result.push({
          ...laterEntry,
          action: "changed_to_signup",
        });
        usedIndices.add(i);
        usedIndices.add(j);
        combined = true;
        break;
      }
    }

    if (!combined) {
      result.push(current);
    }
  }

  // Sort by created_at descending
  return result.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
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

    // Get user names with batching to avoid URL length issues
    const userIds = [...new Set(auditLogs.map((l) => l.user_id))];
    const BATCH_SIZE = 50;
    let allProfiles: { id: string; full_name: string | null; email: string }[] = [];

    if (userIds.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        batches.push(userIds.slice(i, i + BATCH_SIZE));
      }

      const results = await Promise.all(
        batches.map(batch =>
          supabase.from("profiles").select("id, full_name, email").in("id", batch)
        )
      );

      allProfiles = results.flatMap(r => r.data || []);
    }

    const profileMap = new Map(allProfiles.map((p) => [p.id, p.full_name || p.email]));

    const logsWithNames: AuditLogEntry[] = auditLogs.map((log) => ({
      ...log,
      userName: profileMap.get(log.user_id) || "Ukendt",
    }));

    // Combine related actions before setting state
    const combinedLogs = combineRelatedActions(logsWithNames);

    setLogs(combinedLogs);
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
