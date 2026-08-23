import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { flushQueue, isOffline, queueSize } from "@/lib/ascend/offline";
import { qk } from "@/lib/ascend/queries";

/** Shows connection state and replays offline writes as soon as the network returns. */
export function SyncWatcher() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const sync = async () => {
      if (isOffline() || queueSize() === 0) return;
      setSyncing(true);
      const flushed = await flushQueue();
      setSyncing(false);
      setPending(queueSize());
      if (flushed > 0) {
        await qc.invalidateQueries({ queryKey: qk.tasks });
        await qc.invalidateQueries({ queryKey: qk.sessions });
        toast.success(`Synced ${flushed} offline change${flushed === 1 ? "" : "s"}`);
      }
    };

    const onOnline = () => {
      setOffline(false);
      void sync();
    };
    const onOffline = () => setOffline(true);
    const onQueue = (event: Event) => setPending((event as CustomEvent<number>).detail ?? queueSize());

    setOffline(isOffline());
    setPending(queueSize());
    void sync();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("ascend:queue", onQueue);
    const id = window.setInterval(() => void sync(), 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("ascend:queue", onQueue);
      window.clearInterval(id);
    };
  }, [qc]);

  const visible = offline || pending > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="fixed inset-x-0 top-3 z-50 mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-surface/90 px-4 py-1.5 text-xs backdrop-blur"
        >
          {syncing ? (
            <RefreshCw className="size-3.5 animate-spin text-primary" />
          ) : (
            <CloudOff className="size-3.5 text-accent" />
          )}
          <span className="text-muted-foreground">
            {offline
              ? pending > 0
                ? `Offline — ${pending} change${pending === 1 ? "" : "s"} queued`
                : "Offline — changes will sync later"
              : `Syncing ${pending} change${pending === 1 ? "" : "s"}`}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
