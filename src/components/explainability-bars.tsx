import { explainability } from "@/data/kochi";
import { cn } from "@/lib/utils";

export function ExplainabilityBars({
  data = explainability,
  title = "Why this decision",
  className,
}: {
  data?: { label: string; value: number }[];
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <div className="space-y-3">
        {data.map((row, i) => (
          <div key={row.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-foreground">{row.label}</span>
              <span className="font-mono tabular-nums text-muted-foreground">{row.value}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-1000 ease-out",
                  i === 0 ? "bg-primary" : i === 1 ? "bg-foreground/70" : i === 2 ? "bg-chart-5" : "bg-warn",
                )}
                style={{ width: `${row.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
