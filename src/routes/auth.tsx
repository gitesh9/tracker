import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mountain, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localDB, mirrorLocalDataToDb } from "@/lib/ascend/local-store";
import { pullRemote } from "@/lib/ascend/offline";
import {
  adoptAccount,
  cachedAccount,
  fetchAuthStatus,
  signIn,
  signOut,
  signUp,
  type Account,
} from "@/lib/auth/account";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode?: "popup" | "redirect";
            redirect_uri?: string;
            state?: string;
            callback: (response: { code?: string; error?: string; state?: string }) => void;
            error_callback?: (error: unknown) => void;
          }) => {
            requestCode: () => void;
          };
        };
      };
    };
  }
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sign in — Ascend Personal Growth Tracker" },
      {
        name: "description",
        content:
          "Sign in with email or Google to sync your Ascend progress across devices. Everything keeps working offline on this device.",
      },
      { property: "og:title", content: "Sign in to Ascend" },
      {
        property: "og:description",
        content: "One account, every device — and full offline use in between.",
      },
    ],
  }),
  component: AuthPage,
});

const ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in is not set up yet.",
  google_state: "That Google sign-in expired. Please try again.",
  google_failed: "Google could not complete the sign-in.",
};

function AuthPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [configured, setConfigured] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        !origin.endsWith(".run.app") &&
        !origin.includes("localhost") &&
        !origin.includes("127.0.0.1") &&
        origin !== window.location.origin
      ) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        setGoogleBusy(true);
        void fetchAuthStatus()
          .then(async (status) => {
            if (status.user) {
              setAccount(status.user);
              if (status.user.name) localDB.saveProfile({ display_name: status.user.name });
              await mirrorLocalDataToDb();
              await pullRemote();
              await qc.invalidateQueries();
              toast.success(`Signed in as ${status.user.email}`);
              navigate({ to: "/today" });
            }
          })
          .catch(() => {
            toast.error("Signed in, but could not load remote profile.");
          })
          .finally(() => {
            setGoogleBusy(false);
          });
      } else if (event.data?.type === "OAUTH_AUTH_ERROR") {
        setGoogleBusy(false);
        const errKey = event.data.error;
        toast.error(ERRORS[errKey] ?? "Google sign-in did not complete.");
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, [navigate, qc]);

  useEffect(() => {
    qc.setQueryData(["account"], account);
  }, [qc, account]);

  useEffect(() => {
    setName(localDB.getProfile()?.display_name ?? "");
    setAccount(cachedAccount());
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);

    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) toast.error(ERRORS[error] ?? "Sign-in did not complete.");

    void fetchAuthStatus()
      .then(async (status) => {
        setConfigured(status.configured);
        setGoogleEnabled(status.googleEnabled);
        if (status.googleClientId) setGoogleClientId(status.googleClientId);
        setAccount(status.user);
        if (status.user) {
          if (status.user.name) localDB.saveProfile({ display_name: status.user.name });
          await mirrorLocalDataToDb();
          await pullRemote();
          await qc.invalidateQueries();
          if (params.get("google")) {
            toast.success(`Signed in as ${status.user.email}`);
            navigate({ to: "/today" });
          }
        }
      })
      .catch(() => setOffline(true));
  }, [navigate, qc]);

  const handleGoogleAuth = async () => {
    if (offline || !configured || !googleEnabled || googleBusy || busy) return;
    setGoogleBusy(true);

    // 1. Google Identity Services (GIS) Code Model in Popup UX mode
    const gClientId = googleClientId;
    if (gClientId && window.google?.accounts?.oauth2?.initCodeClient) {
      try {
        const client = window.google.accounts.oauth2.initCodeClient({
          client_id: gClientId,
          scope: "openid email profile",
          ux_mode: "popup",
          callback: async (response) => {
            if (response.error) {
              setGoogleBusy(false);
              toast.error(`Google sign-in error: ${response.error}`);
              return;
            }
            if (!response.code) {
              setGoogleBusy(false);
              toast.error("No authorization code received from Google.");
              return;
            }

            try {
              const res = await fetch("/api/public/auth/google/code", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "x-requested-with": "XMLHttpRequest",
                },
                body: JSON.stringify({ code: response.code }),
              });
              const data = (await res.json()) as { ok?: boolean; user?: Account; error?: string };
              if (!res.ok || !data.user) {
                throw new Error(data.error || "Could not complete sign in.");
              }

              adoptAccount(data.user);
              setAccount(data.user);
              if (data.user.name) localDB.saveProfile({ display_name: data.user.name });
              await mirrorLocalDataToDb();
              await pullRemote();
              await qc.invalidateQueries();
              toast.success(`Signed in as ${data.user.email}`);
              navigate({ to: "/today" });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Google sign-in failed.");
            } finally {
              setGoogleBusy(false);
            }
          },
          error_callback: (err) => {
            console.error("[GIS] code client error:", err);
            setGoogleBusy(false);
          },
        });

        client.requestCode();
        return;
      } catch (err) {
        console.warn("[GIS] initCodeClient failed, falling back to server route:", err);
      }
    }

    // 2. Fallback to server route if GIS script was unavailable
    try {
      const origin = window.location.origin;
      const startUrl = `/api/public/auth/google/start?origin=${encodeURIComponent(origin)}`;
      const isIframe = window.self !== window.top;

      if (isIframe) {
        const res = await fetch(`${startUrl}&mode=json`, {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const data = (await res.json()) as { url?: string };
          if (data.url) {
            const popup = window.open(
              data.url,
              "ascend_google_auth",
              "width=540,height=680,menubar=no,toolbar=no,location=no,status=no",
            );
            if (popup) {
              setGoogleBusy(false);
              return;
            }
          }
        }
      }

      window.location.href = startUrl;
    } catch {
      window.location.href = `/api/public/auth/google/start?origin=${encodeURIComponent(window.location.origin)}`;
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user =
        mode === "signin"
          ? await signIn(email, password)
          : await signUp(email, password, name || undefined);
      localDB.saveProfile({ display_name: user.name });
      setAccount(user);
      await mirrorLocalDataToDb();
      await pullRemote();
      await qc.invalidateQueries();
      toast.success(mode === "signin" ? "Welcome back." : "Account created.");
      navigate({ to: "/today" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    await signOut();
    setAccount(null);
    toast.success("Signed out. Your data stays on this device.");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="aurora-backdrop" aria-hidden />
      <motion.div
        suppressHydrationWarning
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="glass-panel relative w-full max-w-sm rounded-3xl p-7"
      >
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl aurora-gradient-bg">
            <Mountain className="size-6 text-primary-foreground" />
          </span>
          <h1 className="font-display text-2xl font-semibold">
            {account ? "Your account" : mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {account
              ? "Your climb syncs across every device you sign in on."
              : "Sign in to sync across devices — the app itself always works offline."}
          </p>
        </div>

        {account ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4 text-sm">
              <p className="font-medium">{account.name}</p>
              <p className="text-muted-foreground">{account.email}</p>
            </div>
            <Button
              className="w-full font-semibold aurora-gradient-bg"
              onClick={() => navigate({ to: "/today" })}
            >
              Continue
            </Button>
            <Button variant="outline" className="w-full" onClick={leave}>
              Sign out
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface/60 p-1 text-sm">
              {(["signin", "signup"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "rounded-lg py-1.5 font-medium transition-colors",
                    mode === value
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {(offline || !configured) && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-surface/60 p-3 text-xs text-muted-foreground">
                <WifiOff className="mt-0.5 size-3.5 shrink-0 text-accent" />
                <span>
                  {offline
                    ? "You are offline — signing in needs a connection, but you can keep using Ascend on this device."
                    : "Accounts are not set up on this copy yet. Everything still works locally."}
                </span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={mode === "signup" ? 8 : 1}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button
                type="submit"
                disabled={busy || offline || !configured}
                className="w-full font-semibold aurora-gradient-bg"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              disabled={offline || !configured || !googleEnabled || googleBusy || busy}
              onClick={handleGoogleAuth}
            >
              {googleBusy ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
              Continue with Google
            </Button>
          </>
        )}

        <button
          type="button"
          onClick={() => navigate({ to: "/today" })}
          className="mt-5 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Continue offline on this device →
        </button>
      </motion.div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.9 0 3.2.8 4 1.5l2.7-2.6C17 3 14.7 2 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}
