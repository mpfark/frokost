import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Mail, Users, Copy, Clock, CheckCircle2, XCircle, Trash, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";

interface Invitation {
  id: string;
  email: string;
  invite_code: string;
  status: string;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  link_sent_at: string | null;
}

export const InvitationManagement = () => {
  const [singleEmail, setSingleEmail] = useState("");
  const [batchEmails, setBatchEmails] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    expired: 0,
    linksSent: 0,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .order("invited_at", { ascending: false });

      if (error) throw error;

      // Calculate stats from all invitations
      const allInvitations = data || [];
      const stats = {
        total: allInvitations.length,
        pending: allInvitations.filter(i => i.status === "pending").length,
        accepted: allInvitations.filter(i => i.status === "accepted").length,
        expired: allInvitations.filter(i => i.status === "expired").length,
        linksSent: allInvitations.filter(i => i.link_sent_at).length,
      };
      setStats(stats);

      // Only show non-accepted invitations in the list
      const displayedInvitations = allInvitations.filter(i => i.status !== "accepted");
      setInvitations(displayedInvitations);
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendInvitation = async (emails: string[]) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invitations", {
        body: { 
          emails,
          batchDescription: emails.length > 1 ? batchDescription : undefined,
        },
      });

      if (error) throw error;

      const { totalSent, totalFailed, results } = data;
      
      if (totalSent > 0) {
        toast({
          title: "Succes",
          description: `${totalSent} invitation${totalSent > 1 ? "er" : ""} sendt${totalFailed > 0 ? ` (${totalFailed} fejlede)` : ""}`,
        });
      }

      if (totalFailed > 0) {
        const failedEmails = results.filter((r: any) => !r.success).map((r: any) => r.email);
        console.error("Failed emails:", failedEmails);
      }

      // Clear form
      setSingleEmail("");
      setBatchEmails("");
      setBatchDescription("");
      
      // Refresh invitations
      fetchInvitations();
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSingle = () => {
    if (!singleEmail.trim()) {
      toast({
        title: "Fejl",
        description: "Indtast venligst en e-mailadresse",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(singleEmail)) {
      toast({
        title: "Fejl",
        description: "Indtast venligst en gyldig e-mailadresse",
        variant: "destructive",
      });
      return;
    }

    sendInvitation([singleEmail]);
  };

  const handleSendBatch = () => {
    if (!batchEmails.trim()) {
      toast({
        title: "Fejl",
        description: "Indtast venligst mindst én e-mailadresse",
        variant: "destructive",
      });
      return;
    }

    // Parse emails (comma or newline separated)
    const emails = batchEmails
      .split(/[\n,]/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emails.length === 0) {
      toast({
        title: "Fejl",
        description: "Ingen gyldige e-mailadresser fundet",
        variant: "destructive",
      });
      return;
    }

    // Validate all emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(e => !emailRegex.test(e));
    
    if (invalidEmails.length > 0) {
      toast({
        title: "Fejl",
        description: `Ugyldige e-mailadresser: ${invalidEmails.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    sendInvitation(emails);
  };

  const deleteInvitation = async () => {
    if (!selectedInvitation) return;
    
    setActionLoading(selectedInvitation.id);
    try {
      const { error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", selectedInvitation.id);

      if (error) throw error;

      toast({
        title: "Slettet",
        description: `Invitation til ${selectedInvitation.email} er slettet`,
      });

      fetchInvitations();
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
      setSelectedInvitation(null);
    }
  };

  const resendInvitation = async () => {
    if (!selectedInvitation) return;
    
    setActionLoading(selectedInvitation.id);
    try {
      // First delete the old invitation
      const { error: deleteError } = await supabase
        .from("invitations")
        .delete()
        .eq("id", selectedInvitation.id);

      if (deleteError) throw deleteError;

      // Then send a new invitation
      const { data, error: sendError } = await supabase.functions.invoke("send-invitations", {
        body: { 
          emails: [selectedInvitation.email],
        },
      });

      if (sendError) throw sendError;

      const { totalSent, totalFailed } = data;
      
      if (totalSent > 0) {
        toast({
          title: "Succes",
          description: `Ny invitation sendt til ${selectedInvitation.email}`,
        });
      } else if (totalFailed > 0) {
        throw new Error("Kunne ikke sende invitation");
      }

      fetchInvitations();
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setResendDialogOpen(false);
      setSelectedInvitation(null);
    }
  };

  const copyInviteLink = (inviteCode: string, email: string) => {
    const link = `${window.location.origin}/#invite=${inviteCode}&email=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Kopieret",
      description: "Invitationslink kopieret til udklipsholder",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Afventer</Badge>;
      case "accepted":
        return <Badge className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" />Accepteret</Badge>;
      case "expired":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Udløbet</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card>
          <CardHeader className="p-3">
            <CardDescription className="text-xs">Samlede</CardDescription>
            <CardTitle className="text-xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardDescription className="text-xs">Links sendt</CardDescription>
            <CardTitle className="text-xl">{stats.linksSent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardDescription className="text-xs">Afventer</CardDescription>
            <CardTitle className="text-xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardDescription className="text-xs">Accepteret</CardDescription>
            <CardTitle className="text-xl">{stats.accepted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardDescription className="text-xs">Udløbet</CardDescription>
            <CardTitle className="text-xl">{stats.expired}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Send Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Send invitationer</CardTitle>
          <CardDescription>Inviter brugere til at deltage i platformen</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="single">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="gap-2">
                <Mail className="h-4 w-4" />
                Enkelt invitation
              </TabsTrigger>
              <TabsTrigger value="batch" className="gap-2">
                <Users className="h-4 w-4" />
                Masseinvitation
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="single" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="single-email">E-mailadresse</Label>
                <Input
                  id="single-email"
                  type="email"
                  placeholder="bruger@firma.dk"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleSendSingle} disabled={isLoading}>
                {isLoading ? "Sender..." : "Send invitation"}
              </Button>
            </TabsContent>

            <TabsContent value="batch" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="batch-emails">E-mailadresser</Label>
                <Textarea
                  id="batch-emails"
                  placeholder="Indtast e-mailadresser (én pr. linje eller kommasepareret)&#10;bruger1@firma.dk&#10;bruger2@firma.dk"
                  rows={6}
                  value={batchEmails}
                  onChange={(e) => setBatchEmails(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  {batchEmails.split(/[\n,]/).filter(e => e.trim().length > 0).length} e-mail(s)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-description">Beskrivelse (valgfri)</Label>
                <Input
                  id="batch-description"
                  placeholder="f.eks. Marketing team invitationer"
                  value={batchDescription}
                  onChange={(e) => setBatchDescription(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleSendBatch} disabled={isLoading}>
                {isLoading ? "Sender..." : "Send masseinvitationer"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle>Alle invitationer</CardTitle>
          <CardDescription>Administrer og spor sendte invitationer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invitations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Ingen invitationer sendt endnu
              </p>
            ) : (
              invitations.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 border rounded gap-2"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{invite.email}</p>
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(invite.invited_at), { addSuffix: true, locale: da })}</span>
                      {invite.status === "pending" && (
                        <span>• Udløber {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true, locale: da })}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {getStatusBadge(invite.status)}
                    {invite.status === "pending" && (
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => copyInviteLink(invite.invite_code, invite.email)}
                          disabled={actionLoading === invite.id}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => {
                            setSelectedInvitation(invite);
                            setResendDialogOpen(true);
                          }}
                          disabled={actionLoading === invite.id}
                          title="Send ny magic link"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedInvitation(invite);
                        setDeleteDialogOpen(true);
                      }}
                      disabled={actionLoading === invite.id}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette invitationen til <strong>{selectedInvitation?.email}</strong>? 
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={deleteInvitation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Slet invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resend Confirmation Dialog */}
      <AlertDialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gensend invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil generere et nyt magic link og sende en ny e-mail til <strong>{selectedInvitation?.email}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={resendInvitation}>
              Gensend invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};