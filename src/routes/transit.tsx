import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlassCard, SectionHeader } from "@/components/ui-kit";
import { busDemand, transitLines } from "@/data/kochi";
import { Train, Bus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transit")({
  head: () => ({
    meta: [
      { title: "Public Transport · Kochi | Project Sentinel" },
      { name: "description", content: "Kochi Metro ridership, bus demand, passenger heatmaps and AI recommendations." },
      { property: "og:title", content: "Public Transport · Kochi" },
      { property: "og:description", content: "Metro and bus demand across Kochi." },
    ],
  }),
  component: TransitPage,
});

function TransitPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Monitor · 02.c</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Public Transport</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Metro ridership, bus demand, passenger heatmap. Sentinel recommends live capacity changes.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard>
            <SectionHeader title="Metro · Kochi" />
            <ul className="space-y-3">
              {transitLines.map((l) => (
                <li key={l.line} className="rounded-2xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Train className="size-4 text-primary" />
                    <p className="text-sm font-medium">{l.line}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Frequency · {l.frequency}</span>
                    <span className="font-mono">Load {l.load}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${l.load}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-primary">Sentinel: {l.extra}</p>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <SectionHeader title="Bus demand · live" />
            <ul className="space-y-3">
              {busDemand.map((b) => (
                <li key={b.corridor} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                  <Bus className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{b.corridor}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full",
                          b.demand > 75 ? "bg-destructive" : b.demand > 50 ? "bg-warn" : "bg-success",
                        )}
                        style={{ width: `${b.demand}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-24 text-right text-xs font-medium text-primary">{b.recommend}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>

        <GlassCard>
          <SectionHeader title="Passenger heatmap · this hour" hint="Density across Kochi transit nodes" />
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
            {Array.from({ length: 48 }).map((_, i) => {
              const intensity = ((i * 37) % 100) / 100;
              return (
                <div
                  key={i}
                  className="aspect-square rounded-md"
                  style={{
                    background: `oklch(${0.98 - intensity * 0.35} ${0.03 + intensity * 0.15} 255)`,
                  }}
                />
              );
            })}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
