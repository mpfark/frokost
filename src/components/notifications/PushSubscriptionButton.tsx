import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BellRing, BellOff, Send } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  let s = "";
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

async function getServerKey(): Promise<string | null> {
  const { data } = await supabase.functions.invoke("send-push-notification", { body: { action: "get_public_key" } });
  return data?.publicKey ?? null;
}

type State = "loading" | "on" | "off" | "unsupported" | "ios-install" | "no-sw";

export const PushSubscriptionButton = () => {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }
    const reg = await withTimeout(navigator.serviceWorker.ready, 5000);
    if (!reg) return setState("no-sw");
    const sub = await reg.pushManager.getSubscription();
    const { data: { user } } = await supabase.auth.getUser();
    if (!sub || !user || Notification.permission !== "granted") return setState("off");

    // Must match server key AND exist in the database for this user
    const serverKey = await getServerKey();
    const subKey = bufToBase64Url(sub.options.applicationServerKey);
    if (serverKey && subKey && subKey !== serverKey) {
      await sub.unsubscribe();
      return setState("off");
    }
    const { data: row } = await supabase
      .from("push_subscriptions").select("id")
      .eq("user_id", user.id).eq("endpoint", sub.endpoint).maybeSingle();
    setState(row ? "on" : "off");
  }, []);

  useEffect(() => { check(); }, [check]);

  const subscribe = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifikationer er blokeret. Tillad dem i telefonens/browserens indstillinger for appen.");
        return;
      }
      const serverKey = await getServerKey();
      if (!serverKey) { toast.error("Kunne ikke hente notifikationsnøglen fra serveren. Prøv igen."); return; }

      const reg = await withTimeout(navigator.serviceWorker.ready, 5000);
      if (!reg) { toast.error("Appen er ikke klar til notifikationer. Genindlæs siden og prøv igen."); return; }

      let sub = await reg.pushManager.getSubscription();
      if (sub && bufToBase64Url(sub.options.applicationServerKey) !== serverKey) {
        await sub.unsubscribe();
        sub = null;
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(serverKey).buffer as ArrayBuffer,
        });
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Du er ikke logget ind."); return; }

      const j = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id, endpoint: j.endpoint!, p256dh: j.keys!.p256dh!, auth: j.keys!.auth!,
      }, { onConflict: "user_id,endpoint" });
      if (error) { console.error(error); toast.error("Telefonen blev tilmeldt, men kunne ikke gemmes. Prøv igen."); return; }

      setState("on");
      toast.success("Push-notifikationer aktiveret!");
    } catch (err) {
      console.error("Push subscription error:", err);
      toast.error("Kunne ikke aktivere notifikationer på denne enhed.");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      const reg = await withTimeout(navigator.serviceWorker.ready, 5000);
      const sub = await reg?.pushManager.getSubscription();
      const { data: { user } } = await supabase.auth.getUser();
      if (sub) {
        if (user) await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Push-notifikationer deaktiveret");
    } catch {
      toast.error("Kunne ikke deaktivere notifikationer");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-push-notification", { body: { action: "self_test" } });
    setBusy(false);
    if (error) return toast.error("Testbesked kunne ikke sendes.");
    if (data?.sent > 0) toast.success("Testbesked sendt – den bør dukke op på enheden om lidt.");
    else toast.error("Ingen tilmeldte enheder modtog testen. Slå notifikationer fra og til igen.");
  };

  if (state === "loading") return null;
  if (state === "ios-install")
    return (
      <p className="text-xs text-muted-foreground">
        På iPhone (iOS 16.4+): tryk på Del-ikonet → "Føj til hjemmeskærm", åbn appen derfra, og slå notifikationer til her.
      </p>
    );
  if (state === "unsupported")
    return <p className="text-xs text-muted-foreground">Denne browser understøtter ikke push-notifikationer.</p>;
  if (state === "no-sw")
    return <p className="text-xs text-muted-foreground">Notifikationer er ikke klar endnu. Genindlæs siden.</p>;

  return (
    <div className="space-y-2">
      <Button
        variant={state === "on" ? "outline" : "default"}
        size="sm"
        onClick={state === "on" ? unsubscribe : subscribe}
        disabled={busy}
        className="w-full gap-2"
      >
        {state === "on" ? <><BellOff className="w-4 h-4" />Slå notifikationer fra</> : <><BellRing className="w-4 h-4" />Slå notifikationer til</>}
      </Button>
      {state === "on" && (
        <Button variant="ghost" size="sm" onClick={sendTest} disabled={busy} className="w-full gap-2">
          <Send className="w-4 h-4" />Send testbesked
        </Button>
      )}
    </div>
  );
};
