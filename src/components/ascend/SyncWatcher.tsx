import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Cloud, CloudOff } from "lucide-react";
import { toast } from "sonner";
import { flushQueue, isOffline, pullRemote, queueSize } from "@/lib/ascend/offline";
import { mirrorLocalDataToDb, reloadTablesFromDb } from "@/lib/ascend/local-store";
import { takeChangedTables } from "@/lib/sync/remote";
import { syncSquads } from "@/lib/ascend/squads-remote";
import { refreshPushSubscription } from "@/lib/ascend/push";

/** Shows connection state, mirrors browser storage into the local database once, and
 *  replays queued writes to the optional remote database whenever a connection exists. */
export function SyncWatcher() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await mirrorLocalDataToDb();
      } catch {
        /* local database unavailable — browser storage keeps the app running */
      }
    };

    let running = false;
    const sync = async () => {
      if (isOffline() || running) return;
      running = true;
      setSyncing(true);
      try {
        const flushed = queueSize() > 0 ? await flushQueue() : 0;
        await pullRemote();
        const changed = takeChangedTables();
        if (changed.length > 0) await reloadTablesFromDb(changed);
        const pulled = changed.length > 0;
        const squads = await syncSquads();
        if (!cancelled && squads) await qc.invalidateQueries({ queryKey: ["squads"] });
        if (!cancelled && (flushed > 0 || pulled)) {
          await Promise.all(changed.map((table) => qc.invalidateQueries({ queryKey: [table] })));
          if (flushed > 0) {
            toast.success(`Synced ${flushed} change${flushed === 1 ? "" : "s"}`);
          }
        }
      } finally {
        running = false;
        if (!cancelled) {
          setSyncing(false);
          setPending(queueSize());
        }
      }
    };

    const onOnline = () => {
      setOffline(false);
      void sync();
    };
    const onOffline = () => setOffline(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const onSignInRequired = () => void qc.invalidateQueries({ queryKey: ["account"] });
    let soon: number | undefined;
    const onQueue = (event: Event) => {
      setPending((event as CustomEvent<number>).detail ?? queueSize());
      // Send fresh edits within a couple of seconds instead of waiting for the next tick.
      window.clearTimeout(soon);
      if (queueSize() > 0) soon = window.setTimeout(() => void sync(), 1500);
    };

    setOffline(isOffline());
    setPending(queueSize());
    void bootstrap()
      .then(sync)
      .then(() => refreshPushSubscription());

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("ascend:queue", onQueue);
    window.addEventListener("ascend:signin-required", onSignInRequired);
    window.addEventListener("ascend:sync-now", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => void sync(), 10_000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("ascend:queue", onQueue);
      window.removeEventListener("ascend:signin-required", onSignInRequired);
      window.removeEventListener("ascend:sync-now", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
      window.clearTimeout(soon);
    };
  }, [qc]);

  // Only surface background syncs that actually take a while.
  const [slowSync, setSlowSync] = useState(false);
  useEffect(() => {
    if (!syncing) {
      setSlowSync(false);
      return;
    }
    const t = window.setTimeout(() => setSlowSync(true), 1200);
    return () => window.clearTimeout(t);
  }, [syncing]);
  const visible = offline || pending > 0 || slowSync;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          role="status"
          className="fixed bottom-20 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-surface/95 px-3 py-2 text-xs shadow-sm md:bottom-4"
        >
          {offline ? (
            <CloudOff className="size-3.5 text-accent" />
          ) : (
            <Cloud className="size-3.5 text-primary" />
          )}
          <span className="text-muted-foreground">
            {syncing
              ? "Syncing…"
              : offline
                ? pending > 0
                  ? `Offline — ${pending} change${pending === 1 ? "" : "s"} saved on this device`
                  : "Offline mode — everything still works"
                : `${pending} change${pending === 1 ? "" : "s"} waiting to sync`}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
