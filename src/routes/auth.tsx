import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Loader2, Mountain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Ascend — Personal Growth Tracker" },
      {
        name: "description",
        content: "Sign in to Ascend to track habits, goals and focus sessions with a calm daily ritual.",
      },
      { property: "og:title", content: "Sign in to Ascend" },
      { property: "og:description", content: "Track habits, goals and focus with Ascend." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/today" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/today`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created — welcome to Ascend.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/today" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/today` },
    });
    if (error) {
      setBusy(false);
      toast.error("Google sign-in failed. Try email instead.");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="aurora-backdrop" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="glass-panel relative w-full max-w-sm rounded-3xl p-7"
      >
        <div className="mb-6 text-center">
          <span
            className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl"
            style={{ backgroundImage: "var(--gradient-aurora)" }}
          >
            <Mountain className="size-6 text-primary-foreground" />
          </span>
          <h1 className="font-display text-2xl font-semibold">
            {mode === "signin" ? "Welcome back" : "Start your ascent"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Pick up where you left off." : "One small climb, every single day."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full font-semibold"
            style={{ backgroundImage: "var(--gradient-aurora)" }}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
          Continue with Google
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signin" ? "No account yet? Create one" : "Already climbing? Sign in"}
        </button>
      </motion.div>
    </div>
  );
}
