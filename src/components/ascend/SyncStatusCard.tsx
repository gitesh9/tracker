import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readSyncStatus, type SyncStatus } from "@/lib/sync/remote";
import { queueSize } from "@/lib/ascend/offline";
import { useAccount } from "@/lib/auth/use-account";

function relative(iso: string | null, now: number): string {
  if (!iso) return "Not synced yet";
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return "Last synced just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Last synced ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Last synced ${hours} h ago`;
  return `Last synced ${new Date(iso).toLocaleDateString()}`;
}

/** "Last synced 2 min ago" plus a Sync now button. */
export function SyncStatusCard() {
  const { data: account } = useAccount();
  const [status, setStatus] = useState<SyncStatus>({ at: null, configured: true });
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setStatus(readSyncStatus());
    setPending(queueSize());
    setOffline(navigator.onLine === false);
    const onSynced = (e: Event) => {
      setStatus((e as CustomEvent<SyncStatus>).detail ?? readSyncStatus());
      setBusy(false);
      setPending(queueSize());
    };
    const onQueue = () => setPending(queueSize());
    const onNet = () => setOffline(navigator.onLine === false);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    window.addEventListener("ascend:synced", onSynced);
    window.addEventListener("ascend:queue", onQueue);
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("ascend:synced", onSynced);
      window.removeEventListener("ascend:queue", onQueue);
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
  }, []);

  const syncNow = () => {
    setBusy(true);
    setNow(Date.now());
    window.dispatchEvent(new CustomEvent("ascend:sync-now"));
    // Stop the spinner even if the sync fails or there is nothing to do.
    window.setTimeout(() => setBusy(false), 8_000);
  };

  const line = !status.configured
    ? "Sync isn't set up on this copy of the app"
    : offline
      ? "Offline — changes are saved on this device"
      : relative(status.at, now);

  return (
    <section className="glass-panel flex items-center gap-3 rounded-2xl p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
        {offline || !status.configured ? <CloudOff className="size-5" /> : <Cloud className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{line}</p>
        <p className="text-xs text-muted-foreground">
          {pending > 0
            ? `${pending} change${pending === 1 ? "" : "s"} waiting to send`
            : account
              ? `Syncing to ${account.email}`
              : "Sign in to sync across devices"}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        disabled={busy || offline || !status.configured}
        onClick={syncNow}
      >
        <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} />
        Sync now
      </Button>
    </section>
  );
}
