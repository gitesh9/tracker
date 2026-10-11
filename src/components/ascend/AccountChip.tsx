import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CloudOff, LogIn } from "lucide-react";
import { useAccount } from "@/lib/auth/use-account";
import { cn } from "@/lib/utils";

/** Header indicator that makes the sign-in state obvious at a glance:
 *  signed in → avatar + name with a sync dot; signed out → a "Sign in" pill. */
export function AccountChip() {
  const { data: account } = useAccount();
  const [offline, setOffline] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    const onExpired = () => setNeedsSignIn(true);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("ascend:signin-required", onExpired);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("ascend:signin-required", onExpired);
    };
  }, []);

  useEffect(() => {
    setNeedsSignIn(false);
  }, [account?.id]);

  if (!account || needsSignIn) {
    return (
      <Link
        to="/auth"
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          needsSignIn
            ? "border-accent/50 bg-accent/10 text-accent hover:bg-accent/15"
            : "border-border/70 bg-surface/60 text-foreground hover:border-primary/40",
        )}
        title={needsSignIn ? "Your session expired — sign in to keep syncing" : "Sign in to sync across devices"}
      >
        <LogIn className="size-3.5" />
        <span>{needsSignIn ? "Sign in again" : "Sign in"}</span>
        <span className="hidden text-muted-foreground sm:inline">· this device only</span>
      </Link>
    );
  }

  const initial = (account.name || account.email || "?").trim().charAt(0).toUpperCase();
  const firstName = (account.name || account.email.split("@")[0] || "").split(" ")[0];

  return (
    <Link
      to="/auth"
      className={cn(
        "flex h-9 items-center gap-2 rounded-full border border-border/70 bg-surface/60 pl-1 pr-3 text-xs transition-colors",
        "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      title={`Signed in as ${account.email}${offline ? " — offline, changes will sync later" : " — syncing across devices"}`}
      aria-label={`Account: ${account.email}`}
    >
      <span className="relative">
        {account.avatarUrl ? (
          <img
            src={account.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-7 rounded-full object-cover"
          />
        ) : (
          <span className="grid size-7 place-items-center rounded-full aurora-gradient-bg text-[12px] font-bold text-primary-foreground">
            {initial}
          </span>
        )}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
            offline ? "bg-accent" : "bg-success",
          )}
          aria-hidden
        />
      </span>
      <span className="hidden max-w-[9rem] truncate font-medium text-foreground sm:inline">
        {firstName}
      </span>
      {offline ? (
        <CloudOff className="size-3.5 text-accent" />
      ) : (
        <span className="hidden text-muted-foreground md:inline">Synced</span>
      )}
    </Link>
  );
}
