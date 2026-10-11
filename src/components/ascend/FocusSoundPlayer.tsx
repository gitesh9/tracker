import { useEffect, useRef, useState } from "react";
import {
  CloudRain,
  Compass,
  Headphones,
  Link as LinkIcon,
  Music,
  Pause,
  Play,
  Radio,
  Sliders,
  Trees,
  Upload,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";
import { SOUND_PRESETS, type SoundPresetKey, soundscapeEngine } from "@/lib/ascend/soundscapes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FocusSoundPlayerProps {
  autoPlayWithTimer?: boolean;
  onAutoPlayChange?: (enabled: boolean) => void;
}

export function FocusSoundPlayer({
  autoPlayWithTimer = true,
  onAutoPlayChange,
}: FocusSoundPlayerProps) {
  const [state, setState] = useState(() => soundscapeEngine.getState());
  const [customTab, setCustomTab] = useState<"presets" | "file" | "url">("presets");
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = soundscapeEngine.subscribe(() => {
      setState(soundscapeEngine.getState());
    });
    return unsubscribe;
  }, []);

  const handlePresetSelect = (key: SoundPresetKey) => {
    if (state.currentKey === key && state.isPlaying) {
      soundscapeEngine.pause();
    } else {
      soundscapeEngine.selectTrack(key);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      soundscapeEngine.setCustomFile(file);
      soundscapeEngine.play("custom_file");
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    soundscapeEngine.setCustomStreamUrl(urlInput.trim());
    soundscapeEngine.play("custom_url");
  };

  const getPresetIcon = (iconName: string) => {
    switch (iconName) {
      case "Waves":
        return <Waves className="size-4" />;
      case "CloudRain":
        return <CloudRain className="size-4" />;
      case "Compass":
        return <Compass className="size-4" />;
      case "Trees":
        return <Trees className="size-4" />;
      case "Radio":
        return <Radio className="size-4" />;
      default:
        return <Headphones className="size-4" />;
    }
  };

  return (
    <div className="glass-panel space-y-4 rounded-2xl p-4 sm:p-5">
      {/* Header with Play/Pause & Equalizer */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-xl transition-all",
              state.isPlaying
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-surface-raised text-muted-foreground",
            )}
          >
            <Music className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight">Ambient Audio &amp; Music</h3>
              {state.isPlaying && (
                <span className="flex items-center gap-0.5">
                  <span className="h-3 w-1 animate-pulse rounded-full bg-primary" />
                  <span className="h-4 w-1 animate-pulse rounded-full bg-primary delay-75" />
                  <span className="h-2 w-1 animate-pulse rounded-full bg-primary delay-150" />
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {state.isPlaying
                ? `Playing: ${
                    state.currentKey === "custom_file"
                      ? state.customFileName || "Custom File"
                      : state.currentKey === "custom_url"
                        ? "Custom Stream"
                        : SOUND_PRESETS.find((p) => p.key === state.currentKey)?.label || "Audio"
                  }`
                : "Choose an ambient soundscape or your own audio"}
            </p>
          </div>
        </div>

        {/* Master Play/Pause Button */}
        <Button
          size="sm"
          onClick={() => soundscapeEngine.togglePlay()}
          className={cn(
            "h-9 rounded-full px-4 text-xs font-semibold transition-all",
            state.isPlaying
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
              : "border border-border bg-surface text-foreground hover:bg-surface-raised",
          )}
        >
          {state.isPlaying ? (
            <>
              <Pause className="mr-1.5 size-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="mr-1.5 size-3.5 fill-current" /> Play Audio
            </>
          )}
        </Button>
      </div>

      {/* Tabs: Presets vs Custom Audio */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="no-scrollbar flex overflow-x-auto rounded-lg border border-border/50 bg-surface/50 p-0.5 text-xs font-medium scroll-smooth">
          <button
            type="button"
            onClick={() => setCustomTab("presets")}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1 transition-colors",
              customTab === "presets"
                ? "bg-surface-raised text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Presets
          </button>
          <button
            type="button"
            onClick={() => setCustomTab("file")}
            className={cn(
              "flex shrink-0 whitespace-nowrap items-center gap-1 rounded-md px-3 py-1 transition-colors",
              customTab === "file"
                ? "bg-surface-raised text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Upload className="size-3" /> Upload File
          </button>
          <button
            type="button"
            onClick={() => setCustomTab("url")}
            className={cn(
              "flex shrink-0 whitespace-nowrap items-center gap-1 rounded-md px-3 py-1 transition-colors",
              customTab === "url"
                ? "bg-surface-raised text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LinkIcon className="size-3" /> Stream URL
          </button>
        </div>

        {/* Volume slider */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => soundscapeEngine.setVolume(state.volume > 0 ? 0 : 0.4)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Toggle mute"
          >
            {state.volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4 text-primary" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.volume}
            onChange={(e) => soundscapeEngine.setVolume(parseFloat(e.target.value))}
            className="h-1.5 w-16 cursor-pointer appearance-none rounded-full bg-border accent-primary sm:w-24"
            aria-label="Volume slider"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {Math.round(state.volume * 100)}%
          </span>
        </div>
      </div>

      {/* Preset Sound Grid */}
      {customTab === "presets" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SOUND_PRESETS.map((preset) => {
            const isSelected = state.currentKey === preset.key;
            const isCurrentPlaying = isSelected && state.isPlaying;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => handlePresetSelect(preset.key)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border/60 bg-surface/40 hover:border-border hover:bg-surface-raised",
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isCurrentPlaying
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-raised text-muted-foreground",
                  )}
                >
                  {getPresetIcon(preset.iconName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-semibold text-foreground">{preset.label}</p>
                    {isCurrentPlaying && (
                      <span className="text-[10px] font-bold text-primary">LIVE</span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                    {preset.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Custom File Upload Tab */}
      {customTab === "file" && (
        <div className="rounded-xl border border-dashed border-border/80 bg-surface/30 p-4 text-center space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mp3,audio/wav,audio/ogg,audio/aac,audio/m4a"
            onChange={handleFileUpload}
            className="hidden"
          />
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold">
              {state.customFileName
                ? `Selected: ${state.customFileName}`
                : "Upload custom audio from your device"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Supports MP3, WAV, OGG, M4A for continuous focus looping
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs"
            >
              <Upload className="mr-1.5 size-3.5" />
              {state.customFileName ? "Choose another file" : "Browse audio file"}
            </Button>
            {state.customFileName && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (state.currentKey === "custom_file" && state.isPlaying) {
                    soundscapeEngine.pause();
                  } else {
                    soundscapeEngine.play("custom_file");
                  }
                }}
                className="text-xs font-semibold text-primary-foreground"
                style={{ backgroundImage: "var(--gradient-aurora)" }}
              >
                {state.currentKey === "custom_file" && state.isPlaying ? (
                  <>
                    <Pause className="mr-1.5 size-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5 size-3.5 fill-current" /> Play File
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Custom Stream URL Tab */}
      {customTab === "url" && (
        <form
          onSubmit={handleUrlSubmit}
          className="rounded-xl border border-border/60 bg-surface/30 p-4 space-y-3"
        >
          <div>
            <label className="text-xs font-semibold">Custom Audio Stream URL</label>
            <p className="text-[11px] text-muted-foreground">
              Paste a direct audio link (e.g. streaming radio or online MP3)
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com/audio-stream.mp3"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="h-9 text-xs bg-surface"
            />
            <Button type="submit" size="sm" className="h-9 text-xs font-semibold shrink-0">
              <Play className="mr-1.5 size-3.5 fill-current" /> Stream
            </Button>
          </div>
        </form>
      )}

      {/* Settings / Auto-play toggle */}
      {onAutoPlayChange && (
        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Sliders className="size-3.5 text-primary" /> Auto-play audio when timer starts
          </span>
          <input
            type="checkbox"
            checked={autoPlayWithTimer}
            onChange={(e) => onAutoPlayChange(e.target.checked)}
            className="size-4 cursor-pointer rounded border-border accent-primary"
          />
        </div>
      )}
    </div>
  );
}
