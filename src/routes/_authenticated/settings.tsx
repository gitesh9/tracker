import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  Download,
  Plus,
  Snowflake,
  Sparkles,
  Trash2,
  User as UserIcon,
  Volume2,
} from "lucide-react";
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
import { isStandalone, subscribeInstallPrompt, triggerInstallPrompt } from "@/lib/ascend/install";
import { InstallModal } from "@/components/ascend/InstallModal";
import { useAccount } from "@/lib/auth/use-account";
import { SyncStatusCard } from "@/components/ascend/SyncStatusCard";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/ascend/push";

const PUSH_COPY: Record<PushState, string> = {
  on: "On for this device — reminders arrive even with the app closed.",
  off: "Off — reminders only appear while Ascend is open.",
  blocked: "Notifications are blocked. Allow them in your browser settings first.",
  unsupported:
    "Not available here. On iPhone, add Ascend to your Home Screen first; elsewhere open it in its own tab.",
  unavailable: "Not set up on the server yet.",
};


export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Settings — Ascend" },
      {
        name: "description",
        content: "Control AI assistance, reminders, notifications and app install.",
      },
      { property: "og:title", content: "Settings — Ascend" },
      { property: "og:description", content: "Tune Ascend to the way you actually work." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { data: reminders = [] } = useReminders();
  const updateProfile = useUpdateProfile();
  const saveReminder = useSaveReminder();
  const deleteReminder = useDeleteReminder();
  const [permission, setPermission] = useState<string>("default");
  const [canInstallNative, setCanInstallNative] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [label, setLabel] = useState("Daily check-in");
  const [time, setTime] = useState("09:00");
  const [displayName, setDisplayName] = useState("");
  const [pushState, setPushState] = useState<PushState>("off");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  useEffect(() => {
    setPermission(notificationPermission());
    setIsAppInstalled(isStandalone());
    void getPushState().then(setPushState);

    const unsubInstall = subscribeInstallPrompt((can) => {
      setCanInstallNative(can);
    });

    return () => {
      unsubInstall();
    };
  }, []);

  const askPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      void showNotification(
        "Notifications enabled",
        "Reminders and focus alerts are now active on this device.",
      );
    } else if (result === "unsupported") {
      toast("Browser notifications unavailable. Ascend will use in-app chimes & alert banners.");
    } else {
      toast(
        "Notifications stay off until allowed in browser settings. In-app alerts remain active.",
      );
    }
  };

  const handleTestReminder = () => {
    void showNotification(
      "Ascend Reminder Test",
      "Your alerts, gentle chime, and haptic feedback are working perfectly across PC, Mac, iPhone, and Android!",
      { playSound: true, vibrate: true },
    );
  };

  const handleInstallClick = async () => {
    if (isAppInstalled) {
      toast.success("Ascend is already installed as a standalone app on this device!");
      setShowInstallModal(true);
      return;
    }

    if (canInstallNative) {
      const res = await triggerInstallPrompt();
      if (res.outcome === "accepted") {
        toast.success("Ascend installed successfully!");
        setIsAppInstalled(true);
      } else if (res.outcome === "dismissed") {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Preferences</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <section className="glass-panel space-y-3 rounded-2xl p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <UserIcon className="size-4 text-primary" /> Your name
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Used on your retrospective card and in squad circles.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="display-name" className="text-xs">
              Display name
            </Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="h-9 text-xs"
            />
          </div>
          <Button
            className="h-9 shrink-0"
            variant="secondary"
            disabled={!displayName.trim() || displayName.trim() === (profile?.display_name ?? "")}
            onClick={() => {
              updateProfile.mutate({ display_name: displayName.trim() });
              toast.success("Name saved");
            }}
          >
            Save
          </Button>
        </div>
      </section>

      <section className="glass-panel space-y-4 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-accent" /> AI workspace
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Timetables, goal breakdowns and procrastination insight. Off keeps every screen fully
              usable.
            </p>
          </div>
          <Switch
            checked={profile?.ai_enabled ?? true}
            onCheckedChange={(value) => updateProfile.mutate({ ai_enabled: value })}
            aria-label="Toggle AI workspace"
          />
        </div>
      </section>

      {/* Reminders & Multi-Device Notifications Section */}
      <section className="glass-panel space-y-4 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Bell className="size-4 text-primary" /> Reminders &amp; Alerts
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Universal reminders with gentle audio chimes, mobile haptics, and system alerts across
              PC, Android, Mac, and iPhone.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {permission !== "granted" && (
              <Button size="sm" variant="outline" onClick={askPermission} className="text-xs h-8">
                Enable system notifications
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={handleTestReminder}
              className="text-xs h-8 flex items-center gap-1.5"
            >
              <Volume2 className="size-3.5 text-primary" />
              <span>Test Alert &amp; Sound</span>
            </Button>
          </div>
        </div>

        {/* Permission status pill */}
        <div className="flex items-center gap-2 rounded-xl bg-surface/60 border border-border/50 px-3 py-2 text-xs">
          <span
            className={`size-2 rounded-full ${
              permission === "granted"
                ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                : "bg-amber-500"
            }`}
          />
          <span className="text-muted-foreground">
            {permission === "granted"
              ? "System notifications: Allowed (Chimes + Haptics + OS banners active)"
              : "System notifications: Off / In-App only (Chimes & in-app alerts active)"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-surface/60 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium">Remind me even when Ascend is closed</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{PUSH_COPY[pushState]}</p>
          </div>
          <Switch
            checked={pushState === "on"}
            disabled={pushBusy || pushState === "unsupported" || pushState === "unavailable"}
            aria-label="Toggle background reminders"
            onCheckedChange={async (value) => {
              setPushBusy(true);
              try {
                const next = value ? await enablePush() : await disablePush();
                setPushState(next);
                setPermission(notificationPermission());
                if (next === "on") toast.success("Background reminders are on for this device");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not turn this on");
              } finally {
                setPushBusy(false);
              }
            }}
          />
        </div>

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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
          <div className="flex-1 space-y-1">
            <Label htmlFor="reminder-label" className="text-xs">
              Label
            </Label>
            <Input
              id="reminder-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Evening review"
              className="h-9 text-xs"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="w-36 space-y-1">
              <Label htmlFor="reminder-time" className="text-xs">
                Time
              </Label>
              <Input
                id="reminder-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9 px-2.5 text-xs [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80"
              />
            </div>
            <Button
              className="h-9 shrink-0"
              onClick={() => {
                if (!label.trim()) return;
                saveReminder.mutate({
                  label: label.trim(),
                  remind_at: `${time}:00`,
                  is_enabled: true,
                });
                toast.success("Reminder added");
                setLabel("Daily check-in");
              }}
            >
              <Plus className="size-4 mr-1 sm:mr-0" />
              <span className="sm:hidden text-xs">Add</span>
            </Button>
          </div>
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

      {/* Install Ascend Section */}
      <section className="glass-panel space-y-3 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Download className="size-4 text-primary" /> Install Ascend
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add Ascend to your phone home screen, desktop dock, or apps menu for lightning-fast
              launch, full offline mode, and distraction-free full-screen timers.
            </p>
          </div>
          {isAppInstalled && (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 shrink-0">
              <CheckCircle2 className="size-3" /> Installed
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            id="install-ascend-btn"
            size="sm"
            variant="default"
            className="font-medium text-xs h-9 px-4"
            style={{ backgroundImage: isAppInstalled ? undefined : "var(--gradient-aurora)" }}
            onClick={handleInstallClick}
          >
            <Download className="size-3.5 mr-1.5" />
            {isAppInstalled
              ? "App Installed (View Details)"
              : canInstallNative
                ? "Install Ascend App"
                : "Install on Device"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-9"
            onClick={() => setShowInstallModal(true)}
          >
            Installation Guide
          </Button>
        </div>
      </section>

      {/* Install Dialog Modal */}
      <InstallModal open={showInstallModal} onOpenChange={setShowInstallModal} />

      <SyncStatusCard />

      <section className="glass-panel space-y-3 rounded-2xl p-4 text-center">
        <p className="text-sm font-medium">
          {account ? `Signed in as ${account.email}` : "Not signed in — data stays on this device"}
        </p>
        <p className="text-xs text-muted-foreground">
          {account
            ? "Tasks, goals, focus sessions and growth history sync to your account whenever you are online, and keep working offline in between."
            : "Everything works with no internet at all. Sign in to back up your progress and see it on every device you use."}
        </p>
        <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/auth" })}>
          <UserIcon className="size-4" /> {account ? "Manage account" : "Sign in to sync"}
        </Button>
      </section>
    </div>
  );
}
