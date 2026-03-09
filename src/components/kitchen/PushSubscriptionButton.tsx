import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const PushSubscriptionButton = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // All users can subscribe to push notifications

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setIsSupported(false);
        setIsLoading(false);
        return;
      }

      setIsSupported(true);

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch {
        setIsSubscribed(false);
      }
      setIsLoading(false);
    };

    checkSubscription();
  }, []);

  const subscribe = async () => {
    if (!VAPID_PUBLIC_KEY) {
      toast.error("Push-notifikationer er ikke konfigureret endnu");
      return;
    }

    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifikationer blev afvist. Tillad dem i browserindstillingerne.");
        setIsLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke logget ind");

      const subJson = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subJson.endpoint!,
        p256dh: subJson.keys!.p256dh!,
        auth: subJson.keys!.auth!,
      }, { onConflict: "user_id,endpoint" });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("Push-notifikationer aktiveret!");
    } catch (err: any) {
      console.error("Push subscription error:", err);
      toast.error("Kunne ikke aktivere notifikationer");
    }
    setIsLoading(false);
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", subscription.endpoint);
        }
      }
      setIsSubscribed(false);
      toast.success("Push-notifikationer deaktiveret");
    } catch (err) {
      console.error("Unsubscribe error:", err);
      toast.error("Kunne ikke deaktivere notifikationer");
    }
    setIsLoading(false);
  };

  if (!isSupported) {
    return null;
  }

  if (!canSubscribe) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="w-full gap-2 opacity-50 cursor-not-allowed"
        title="Kun tilgængelig for køkkenpersonale"
      >
        <BellOff className="w-4 h-4 text-muted-foreground" />
        Notifikationer (kun køkken)
      </Button>
    );
  }

  return (
    <Button
      variant={isSubscribed ? "outline" : "default"}
      size="sm"
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading}
      className="w-full gap-2"
    >
      {isSubscribed ? (
        <>
          <BellOff className="w-4 h-4" />
          Slå notifikationer fra
        </>
      ) : (
        <>
          <BellRing className="w-4 h-4" />
          Slå notifikationer til
        </>
      )}
    </Button>
  );
};
