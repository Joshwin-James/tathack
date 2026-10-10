import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useSentinelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const kindIcon = {
  critical: { Icon: AlertCircle, color: "text-destructive bg-destructive/10" },
  warning: { Icon: AlertTriangle, color: "text-warn bg-warn/10" },
  resolved: { Icon: CheckCircle2, color: "text-success bg-success/10" },
  system: { Icon: Info, color: "text-muted-foreground bg-secondary" },
} as const;

export function NotificationCenter({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { notifications } = useSentinelStore();
  const groups = [
    { key: "critical" as const, label: "Critical Alerts" },
    { key: "warning" as const, label: "Warnings" },
    { key: "resolved" as const, label: "Resolved" },
    { key: "system" as const, label: "System Updates" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>Notifications</SheetTitle>
          <p className="text-xs text-muted-foreground">3 unread · Kochi Command</p>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {groups.map((g) => {
            const items = notifications.filter((n) => n.kind === g.key);
            if (!items.length) return null;
            return (
              <div key={g.key}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {g.label}
                </p>
                <div className="space-y-2">
                  {items.map((n) => {
                    const { Icon, color } = kindIcon[n.kind];
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "flex gap-3 rounded-2xl border border-border p-3",
                          !n.read ? "bg-background" : "bg-secondary/50",
                        )}
                      >
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", color)}>
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{n.title}</p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">{n.minutesAgo}m</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{n.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
