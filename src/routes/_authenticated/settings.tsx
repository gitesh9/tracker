import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, Download, LogOut, Plus, Snowflake, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteReminder,
  useProfile,
  useReminders,
  useSaveReminder,
  useUpdateProfile,
} from "@/lib/ascend/queries";
import {
  notificationPermission,
  requestNotificationPermission,
  showNotification,
} from "@/lib/ascend/notifications";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ascend" },
      { name: "description", content: "Control AI assistance, reminders, notifications and app install." },
      { property: "og:title", content: "Settings — Ascend" },
      { property: "og:description", content: "Tune Ascend to the way you actually work." },
    ],
  }),
  component: SettingsPage,
});

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

function SettingsPage() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: reminders = [] } = useReminders();
  const updateProfile = useUpdateProfile();
  const saveReminder = useSaveReminder();
  const deleteReminder = useDeleteReminder();
  const [permission, setPermission] = useState<string>("default");
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [label, setLabel] = useState("Daily check-in");
  const [time, setTime] = useState("09:00");

  useEffect(() => {
    setPermission(notificationPermission());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const askPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") showNotification("Notifications on", "We'll nudge you at your reminder times.");
    else if (result === "unsupported") toast.error("This browser doesn't support notifications");
    else toast("Notifications stay off until you allow them in the browser.");
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Preferences</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <section className="glass-panel space-y-4 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-accent" /> AI workspace
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Timetables, goal breakdowns and procrastination insight. Off keeps every screen fully usable.
            </p>
          </div>
          <Switch
            checked={profile?.ai_enabled ?? true}
            onCheckedChange={(value) => updateProfile.mutate({ ai_enabled: value })}
            aria-label="Toggle AI workspace"
          />
        </div>
      </section>

      <section className="glass-panel space-y-4 rounded-2xl p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Bell className="size-4 text-primary" /> Reminders
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {permission === "granted"
              ? "Notifications allowed — reminders fire while Ascend is open."
              : "Allow notifications to get nudged at your chosen times."}
          </p>
        </div>
        {permission !== "granted" && (
          <Button size="sm" variant="outline" onClick={askPermission}>
            Enable notifications
          </Button>
        )}

        <div className="space-y-2">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
              <span className="font-mono text-xs text-primary">
                {String(reminder.remind_at).slice(0, 5)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{reminder.label}</span>
              <Switch
                checked={reminder.is_enabled}
                aria-label={`Toggle ${reminder.label}`}
                onCheckedChange={(value) =>
                  saveReminder.mutate({
                    id: reminder.id,
                    label: reminder.label,
                    remind_at: reminder.remind_at,
                    is_enabled: value,
                  })
                }
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${reminder.label}`}
                onClick={() => deleteReminder.mutate(reminder.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {reminders.length === 0 && (
            <p className="text-xs text-muted-foreground">No reminders yet.</p>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="reminder-label" className="text-xs">
              Label
            </Label>
            <Input
              id="reminder-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Evening review"
            />
          </div>
          <div className="w-28 space-y-1">
            <Label htmlFor="reminder-time" className="text-xs">
              Time
            </Label>
            <Input
              id="reminder-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <Button
            onClick={() => {
              if (!label.trim()) return;
              saveReminder.mutate({ label: label.trim(), remind_at: `${time}:00`, is_enabled: true });
              toast.success("Reminder added");
              setLabel("Daily check-in");
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </section>

      <section className="glass-panel flex items-center justify-between gap-4 rounded-2xl p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Snowflake className="size-4 text-accent" /> Streak freezes
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Auto-spent on a missed day so one slip doesn't reset your streak.
          </p>
        </div>
        <span className="font-display text-2xl font-semibold">{profile?.streak_freezes ?? 0}</span>
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Download className="size-4 text-primary" /> Install Ascend
        </p>
        <p className="text-xs text-muted-foreground">
          Install from the published app for a home-screen icon and offline access. On iOS use Share →
          Add to Home Screen.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={!installEvent}
          onClick={async () => {
            await installEvent?.prompt();
            setInstallEvent(null);
          }}
        >
          {installEvent ? "Install app" : "Install prompt unavailable here"}
        </Button>
      </section>

      <Button
        variant="ghost"
        className="w-full text-muted-foreground"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/auth" });
        }}
      >
        <LogOut className="size-4" /> Sign out
      </Button>
    </div>
  );
}
