import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const WebflowSyncSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['webflow-sync-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webflow_sync_settings')
        .select('*')
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
      return data;
    },
  });

  const { data: syncLogs } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('sync_started_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (settings) {
        const { error } = await supabase
          .from('webflow_sync_settings')
          .update(updates)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('webflow_sync_settings')
          .insert(updates);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webflow-sync-settings'] });
      toast({
        title: "Indstillinger gemt",
        description: "Webflow sync indstillingerne er opdateret",
      });
    },
    onError: (error) => {
      toast({
        title: "Fejl",
        description: `Kunne ikke gemme indstillinger: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const testConnection = async () => {
    if (!settings?.collection_id) {
      toast({
        title: "Mangler konfiguration",
        description: "Indtast Collection ID først",
        variant: "destructive",
      });
      return;
    }

    setIsTestingConnection(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://api.webflow.com/v2/collections/${settings.collection_id}/items?limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.functions.invoke('get-webflow-token')).data?.token || ''}`,
            'accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        toast({
          title: "Forbindelse OK",
          description: "Kan forbinde til Webflow CMS",
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Forbindelsesfejl",
        description: `Kunne ikke forbinde til Webflow: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('webflow-sync', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['webflow-sync-settings'] });

      toast({
        title: "Synkronisering fuldført",
        description: `Tilføjet: ${data.users_added}, Opdateret: ${data.users_updated}, Fjernet: ${data.users_removed}`,
      });
    } catch (error) {
      toast({
        title: "Synkroniseringsfejl",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webflow CMS Integration</CardTitle>
          <CardDescription>
            Synkroniser medarbejdere automatisk fra Webflow CMS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-id">Site ID</Label>
              <Input
                id="site-id"
                value={settings?.site_id || ''}
                onChange={(e) => updateSettingsMutation.mutate({ site_id: e.target.value })}
                placeholder="Din Webflow Site ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="collection-id">Collection ID</Label>
              <Input
                id="collection-id"
                value={settings?.collection_id || ''}
                onChange={(e) => updateSettingsMutation.mutate({ collection_id: e.target.value })}
                placeholder="Din Webflow Collection ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync-frequency">Synkroniseringsfrekvens</Label>
              <Select
                value={settings?.sync_frequency || 'manual'}
                onValueChange={(value) => updateSettingsMutation.mutate({ sync_frequency: value })}
              >
                <SelectTrigger id="sync-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuel</SelectItem>
                  <SelectItem value="daily">Dagligt</SelectItem>
                  <SelectItem value="weekly">Ugentligt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="removal-policy">Fjernelsespolitik</Label>
              <Select
                value={settings?.removal_policy || 'deactivate'}
                onValueChange={(value) => updateSettingsMutation.mutate({ removal_policy: value })}
              >
                <SelectTrigger id="removal-policy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deactivate">Deaktiver (anbefalet)</SelectItem>
                  <SelectItem value="soft-delete">Slet bruger (behold data)</SelectItem>
                  <SelectItem value="full-delete">Fuld sletning</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Hvad skal der ske med brugere der fjernes fra Webflow?
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={testConnection}
                disabled={isTestingConnection || !settings?.collection_id}
                variant="outline"
              >
                {isTestingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test forbindelse
              </Button>

              <Button
                onClick={triggerSync}
                disabled={isSyncing || !settings?.collection_id}
              >
                {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="mr-2 h-4 w-4" />
                Synkroniser nu
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {settings?.last_sync_at && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Sidst synkroniseret: {new Date(settings.last_sync_at).toLocaleString('da-DK')}
          </AlertDescription>
        </Alert>
      )}

      {syncLogs && syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Synkroniseringshistorik</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {syncLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between border-b pb-4 last:border-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {log.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {log.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                      {log.status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span className="font-medium capitalize">{log.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(log.sync_started_at).toLocaleString('da-DK')}
                    </p>
                    {log.status === 'completed' && (
                      <p className="text-sm">
                        Tilføjet: {log.users_added}, Opdateret: {log.users_updated}, Fjernet: {log.users_removed}
                      </p>
                    )}
                    {log.error_message && (
                      <p className="text-sm text-destructive">{log.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
