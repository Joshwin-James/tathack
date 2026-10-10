import { systemStatus } from "@/data/kochi";
import { cn } from "@/lib/utils";

export function SystemStatusBar({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      {systemStatus.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1",
            compact && "px-2.5 py-0.5",
          )}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-success/60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span className="font-medium text-foreground">{item.label}</span>
          {!compact && <span className="text-muted-foreground">Live</span>}
        </div>
      ))}
    </div>
  );
}
