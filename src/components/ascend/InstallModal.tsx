import { useEffect, useState } from "react";
import {
  Check,
  Compass,
  Download,
  ExternalLink,
  Laptop,
  PlusSquare,
  Share2,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDeferredPrompt,
  isInIframe,
  isIOS,
  isStandalone,
  subscribeInstallPrompt,
  triggerInstallPrompt,
} from "@/lib/ascend/install";
import { toast } from "sonner";

interface InstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallModal({ open, onOpenChange }: InstallModalProps) {
  const [canInstallNative, setCanInstallNative] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setInIframe(isInIframe());
    setIosDevice(isIOS());

    const unsub = subscribeInstallPrompt((can) => {
      setCanInstallNative(can);
    });
    return unsub;
  }, []);

  if (!open) return null;

  const handleNativeInstall = async () => {
    const res = await triggerInstallPrompt();
    if (res.outcome === "accepted") {
      toast.success("Ascend installed successfully! Check your home screen or apps menu.");
      onOpenChange(false);
    } else if (res.outcome === "iframe") {
      window.open(window.location.origin + "/settings", "_blank");
    }
  };

  const handleOpenStandalone = () => {
    window.open(window.location.origin + "/settings", "_blank");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog Box */}
      <div className="relative w-full max-w-md rounded-2xl border border-border/80 bg-surface/95 p-5 sm:p-6 shadow-2xl backdrop-blur-xl transition-all space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Download className="size-5" />
            </span>
            <div>
              <h2
                id="install-modal-title"
                className="font-display text-base font-semibold text-foreground"
              >
                Install Ascend
              </h2>
              <p className="text-xs text-muted-foreground">Fast, offline-first home screen app</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Status / Condition */}
        {installed ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center space-y-2">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">Ascend is already installed!</p>
            <p className="text-xs text-muted-foreground">
              You are running Ascend as a dedicated standalone app with full offline capabilities
              and instant loading.
            </p>
          </div>
        ) : inIframe ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-3.5 space-y-1.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-4 text-accent" /> Live Sandbox Detected
              </p>
              <p className="text-xs text-muted-foreground">
                Browser security blocks direct PWA installation inside preview frames. Open Ascend
                in a standalone browser tab to install to your device.
              </p>
            </div>
            <Button
              className="w-full font-semibold"
              style={{ backgroundImage: "var(--gradient-aurora)" }}
              onClick={handleOpenStandalone}
            >
              <ExternalLink className="mr-2 size-4" /> Open Full App &amp; Install
            </Button>
          </div>
        ) : iosDevice ? (
          /* iOS Step-by-Step Guide */
          <div className="space-y-3.5">
            <div className="rounded-xl border border-border/60 bg-surface/50 p-3 text-xs text-muted-foreground">
              Install Ascend on your iPhone or iPad in 3 simple steps without the App Store:
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-surface/40 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  1
                </span>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    Tap the Share icon <Share2 className="size-3.5 text-primary inline" />
                  </p>
                  <p className="text-muted-foreground">
                    Located in Safari's bottom toolbar (or top on iPad).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-surface/40 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  2
                </span>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    Select "Add to Home Screen"{" "}
                    <PlusSquare className="size-3.5 text-primary inline" />
                  </p>
                  <p className="text-muted-foreground">
                    Scroll down the share sheet menu to find this option.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-surface/40 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  3
                </span>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Tap "Add" in top-right</p>
                  <p className="text-muted-foreground">
                    Ascend will appear instantly on your home screen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : canInstallNative ? (
          /* Android / Desktop Chrome with Native Prompt */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Install Ascend on your device for instant launch, offline tracking, immersive
              full-screen focus timers, and system notifications.
            </p>
            <Button
              className="w-full font-semibold"
              style={{ backgroundImage: "var(--gradient-aurora)" }}
              onClick={handleNativeInstall}
            >
              <Download className="mr-2 size-4" /> Install Ascend App
            </Button>
          </div>
        ) : (
          /* Desktop Chrome/Edge/Mac browser guidance */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              You can install Ascend directly from your browser:
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-surface/40 p-3">
                <Laptop className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Chrome / Edge / Brave</p>
                  <p className="text-muted-foreground">
                    Click the install icon <span className="font-mono text-primary">⊕</span> in your
                    browser's address bar, or open the menu (<span className="font-bold">⋮</span>)
                    &rarr; "Install Ascend".
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-surface/40 p-3">
                <Compass className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Safari on macOS (Sonoma+)</p>
                  <p className="text-muted-foreground">
                    In Safari menu bar, click{" "}
                    <span className="font-semibold text-foreground">
                      File &rarr; Add to Dock...
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Benefits list */}
        <div className="border-t border-border/40 pt-3">
          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="size-3 text-primary" /> Full offline mode
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3 text-primary" /> Full-screen focus
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3 text-primary" /> Instant home launch
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3 text-primary" /> Multi-device sync
            </span>
          </div>
        </div>

        <Button variant="outline" className="w-full text-xs" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>
    </div>
  );
}
