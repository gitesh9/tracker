import { useState } from "react";
import { motion } from "motion/react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { customRange, presetRange, RANGE_PRESETS, type DateRange } from "@/lib/ascend/range";
import { todayISO } from "@/lib/ascend/cadence";

export function RangeSelector({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [from, setFrom] = useState(value.from === "1970-01-01" ? todayISO() : value.from);
  const [to, setTo] = useState(value.to);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="glass-panel flex w-full items-center gap-1 overflow-x-auto rounded-full p-1">
        {RANGE_PRESETS.map((preset) => {
          const active = value.key === preset.key;
          return (
            <button
              key={preset.key}
              onClick={() => onChange(presetRange(preset.key))}
              className={cn(
                "relative shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors",
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="range-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundImage: "var(--gradient-aurora)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{preset.label}</span>
            </button>
          );
        })}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Custom date range"
              className={cn(
                "relative ml-auto shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors",
                value.key === "custom"
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value.key === "custom" && (
                <motion.span
                  layoutId="range-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundImage: "var(--gradient-aurora)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <CalendarRange className="size-3.5" /> Custom
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="range-from" className="text-xs">
                From
              </Label>
              <Input
                id="range-from"
                type="date"
                value={from}
                max={todayISO()}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="range-to" className="text-xs">
                To
              </Label>
              <Input
                id="range-to"
                type="date"
                value={to}
                max={todayISO()}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!from || !to) return;
                onChange(customRange(from, to));
                setOpen(false);
              }}
            >
              Apply range
            </Button>
          </PopoverContent>
        </Popover>
      </div>
      <p className="px-1 text-xs text-muted-foreground">{value.label}</p>
    </div>
  );
}
