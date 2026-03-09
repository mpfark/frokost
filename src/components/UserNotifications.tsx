import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow, parseISO } from "date-fns";
import { da } from "date-fns/locale";

interface UserNotification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, any>;
}

export const UserNotifications = () => {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("user_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications((data as UserNotification[]) || []);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("user_notifications_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications" },
        () => fetchNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllAsRead = async () => {
    await supabase
      .from("user_notifications")
      .update({ is_read: true })
      .eq("is_read", false);
    fetchNotifications();
  };

  const deleteAll = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("user_notifications")
      .delete()
      .in("id", ids);
    if (error) {
      console.error("Failed to delete user notifications:", error);
      return;
    }
    fetchNotifications();
  };

  const getIcon = (type: string) => {
    if (type === "order_confirmed") return <CheckCircle className="w-4 h-4 text-primary shrink-0" />;
    return <Bell className="w-4 h-4 text-primary shrink-0" />;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifikationer</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={markAllAsRead} title="Markér alle læst">
                <Check className="w-3.5 h-3.5" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteAll(); }} title="Slet alle">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen notifikationer</p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 text-sm transition-colors ${!n.is_read ? "bg-accent/30" : ""}`}
                >
                  {getIcon(n.type)}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={`text-xs leading-relaxed ${!n.is_read ? "font-medium" : "text-muted-foreground"}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: da })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
