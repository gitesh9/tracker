import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, MicOff, Plus, Sparkles } from "lucide-react";
import { parseQuickAdd } from "@/lib/ascend/quick-add";
import { iconFor } from "@/lib/ascend/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
}

export function QuickAdd({
  onAdd,
  goalOptions,
}: {
  onAdd: (parsed: ReturnType<typeof parseQuickAdd>, goalId: string | null) => void;
  goalOptions: { id: string; title: string }[];
}) {
  const [value, setValue] = useState("");
  const [goalId, setGoalId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [supportsVoice, setSupportsVoice] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupportsVoice(true);
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i]![0]!.transcript).join(
        " ",
      );
      setValue(transcript);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => rec.stop();
  }, []);

  const preview = value.trim() ? parseQuickAdd(value) : null;
  const PreviewIcon = iconFor(preview?.icon_name);

  const submit = () => {
    if (!preview) return;
    onAdd(preview, goalId);
    setValue("");
    inputRef.current?.focus();
  };

  const toggleVoice = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      setValue("");
      rec.start();
      setListening(true);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-2" style={{ boxShadow: "var(--shadow-soft)" }}>
      <div className="flex items-center gap-2">
        <Sparkles className="ml-2 size-4 shrink-0 text-primary" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Gym 3x per week 45 min high energy…"
          className="border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
        />
        {supportsVoice && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={toggleVoice}
            aria-label={listening ? "Stop dictation" : "Dictate task"}
            className={cn("shrink-0 rounded-xl", listening && "text-destructive")}
          >
            {listening ? (
              <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                <MicOff className="size-4" />
              </motion.span>
            ) : (
              <Mic className="size-4" />
            )}
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={!preview}
          aria-label="Add task"
          className="shrink-0 rounded-xl"
          style={{ backgroundImage: preview ? "var(--gradient-aurora)" : undefined }}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 px-2 pb-1 pt-3 text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-1">
                <PreviewIcon className="size-3 text-primary" />
                {preview.title}
              </span>
              <span className="rounded-full bg-muted px-2 py-1 capitalize text-muted-foreground">{preview.domain}</span>
              {preview.hints.map((hint) => (
                <span key={hint} className="rounded-full bg-primary/15 px-2 py-1 text-primary">
                  {hint}
                </span>
              ))}
              {goalOptions.length > 0 && (
                <select
                  value={goalId ?? ""}
                  onChange={(e) => setGoalId(e.target.value || null)}
                  className="rounded-full bg-muted px-2 py-1 text-muted-foreground outline-none"
                  aria-label="Link to goal"
                >
                  <option value="">No goal</option>
                  {goalOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
