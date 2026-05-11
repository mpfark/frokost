import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays } from "date-fns";
import { da } from "date-fns/locale";
import { RefreshCw, ChevronLeft, ChevronRight, Mail, CheckCircle2, XCircle, Ban } from "lucide-react";

type EmailLog = {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  triggered_by_label: string | null;
};

type Stats = {
  total: number;
  sent: number;
  failed: number;
  suppressed: number;
};

const TEMPLATE_LABELS: Record<string, string> = {
  auth_emails: "Auth (login/reset)",
  invitation: "Invitation",
  "weekly-reminder": "Ugentlig påmindelse",
  "manual-reminder": "Manuel påmindelse",
  "password-reset": "Password reset",
  transactional_emails: "Transaktionel",
};

const labelTemplate = (name: string) => TEMPLATE_LABELS[name] ?? name;

const statusBadge = (status: string) => {
  switch (status) {
    case "sent":
      return <Badge className="bg-green-600 hover:bg-green-600">Sendt</Badge>;
    case "failed":
    case "dlq":
    case "bounced":
      return <Badge variant="destructive">{status === "dlq" ? "Fejlet (DLQ)" : status === "bounced" ? "Bounced" : "Fejlet"}</Badge>;
    case "suppressed":
      return <Badge variant="secondary">Undertrykt</Badge>;
    case "complained":
      return <Badge variant="secondary">Klage</Badge>;
    case "pending":
      return <Badge variant="outline">Afventer</Badge>;
    case "rate_limited":
      return <Badge variant="outline">Rate limited</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const PAGE_SIZE = 50;

export const EmailLogTable = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, suppressed: 0 });
  const [templates, setTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    const end = new Date();
    const start = subDays(end, rangeDays);

    const params = new URLSearchParams({
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      template_name: templateFilter,
      status: statusFilter,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });

    const { data, error } = await supabase.functions.invoke(
      `get-email-logs?${params.toString()}`,
      { method: "GET" }
    );

    if (error || !data) {
      setLogs([]);
      setStats({ total: 0, sent: 0, failed: 0, suppressed: 0 });
      setLoading(false);
      return;
    }

    setLogs(data.logs ?? []);
    setStats(data.stats ?? { total: 0, sent: 0, failed: 0, suppressed: 0 });
    setTemplates(data.templates ?? []);
    setLoading(false);
  };

  useEffect(() => {
    setPage(0);
  }, [rangeDays, templateFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, templateFilter, statusFilter, page]);

  const totalPages = Math.max(1, Math.ceil(stats.total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Mail className="h-4 w-4" /> Total
            </div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> Sendt
            </div>
            <div className="text-2xl font-bold mt-1">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <XCircle className="h-4 w-4 text-destructive" /> Fejlet
            </div>
            <div className="text-2xl font-bold mt-1">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Ban className="h-4 w-4" /> Undertrykt
            </div>
            <div className="text-2xl font-bold mt-1">{stats.suppressed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Email log</CardTitle>
            <CardDescription>Udsendte mails fra systemet (dedupet pr. mail)</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Seneste 24t</SelectItem>
                <SelectItem value="7">Seneste 7 dage</SelectItem>
                <SelectItem value="30">Seneste 30 dage</SelectItem>
              </SelectContent>
            </Select>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Skabelon" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle skabeloner</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t} value={t}>{labelTemplate(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle status</SelectItem>
                <SelectItem value="sent">Sendt</SelectItem>
                <SelectItem value="failed">Fejlet</SelectItem>
                <SelectItem value="suppressed">Undertrykt</SelectItem>
                <SelectItem value="pending">Afventer</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tidspunkt</TableHead>
                      <TableHead>Modtager</TableHead>
                      <TableHead>Skabelon</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fejl</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {format(parseISO(log.created_at), "d. MMM HH:mm", { locale: da })}
                        </TableCell>
                        <TableCell className="font-medium">{log.recipient_email}</TableCell>
                        <TableCell><Badge variant="outline">{labelTemplate(log.template_name)}</Badge></TableCell>
                        <TableCell>{statusBadge(log.status)}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground" title={log.error_message ?? ""}>
                          {log.error_message ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Ingen mails sendt i den valgte periode
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {stats.total > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Side {page + 1} af {totalPages} ({stats.total} mails)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                      <ChevronLeft className="h-4 w-4" /> Forrige
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
                      Næste <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
