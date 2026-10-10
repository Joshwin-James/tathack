import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  as: Comp = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Comp
      className={cn(
        "rounded-3xl border border-border bg-card p-5 soft-shadow",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warn" | "danger" | "success" | "primary";
}) {
  const toneColor = {
    neutral: "text-foreground",
    warn: "text-warn",
    danger: "text-destructive",
    success: "text-success",
    primary: "text-primary",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-2xl font-semibold", toneColor)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SeverityChip({ severity }: { severity: "critical" | "warning" | "info" | "resolved" }) {
  const map = {
    critical: "bg-destructive/10 text-destructive",
    warning: "bg-warn/10 text-warn",
    info: "bg-accent text-accent-foreground",
    resolved: "bg-success/10 text-success",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", map[severity])}>
      {severity}
    </span>
  );
}

export function LiveBadge({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-destructive">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-destructive" />
        <span className="relative inline-flex size-1.5 rounded-full bg-destructive" />
      </span>
      {label}
    </span>
  );
}

export function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
