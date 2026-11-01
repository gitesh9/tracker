import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="flex min-h-40 flex-col items-center justify-center gap-3 py-8 text-center">
    <Icon className="size-6 text-primary/70" aria-hidden="true" />
    <div className="max-w-sm space-y-1.5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {children && <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>}
    </div>
    {action}
  </div>;
}