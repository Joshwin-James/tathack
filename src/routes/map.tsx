import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CityMap } from "@/components/city-map";
import { City3DMap } from "@/components/city-3d-map";
import { AgentReasoningStream } from "@/components/agent-reasoning-stream";
import { ExplainabilityBars } from "@/components/explainability-bars";
import { GlassCard, LiveBadge, SectionHeader, SeverityChip } from "@/components/ui-kit";
import { useSentinelStore } from "@/lib/store";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Box, Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Digital Twin Map · Kochi | Project Sentinel" },
      { name: "description", content: "Live urban digital twin of Kochi. Real-time incidents, traffic, flood and transit overlays." },
      { property: "og:title", content: "Digital Twin Map · Kochi" },
      { property: "og:description", content: "Live urban digital twin of Kochi." },
    ],
  }),
  component: MapPage,
});

const layers = [
  { key: "buildings", label: "Buildings (3D)" },
  { key: "traffic", label: "Traffic" },
  { key: "cctv", label: "CCTV" },
  { key: "transit", label: "Transit" },
];

function MapPage() {
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [active, setActive] = useState<string[]>(["buildings", "traffic", "cctv", "transit"]);
  const toggle = (k: string) =>
    setActive((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  const { incidents } = useSentinelStore();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Monitor · 02</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Digital Twin</h1>
            <p className="mt-1 text-sm text-muted-foreground">Live urban model of Kochi. Every pin is a real-time signal.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge />

            {/* View Mode Toggle: 3D Twin vs 2D GIS */}
            <div className="flex items-center rounded-full border border-border bg-card p-0.5 soft-shadow">
              <button
                onClick={() => setViewMode("3d")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all",
                  viewMode === "3d"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Box className="size-3.5" />
                <span>3D Twin</span>
              </button>
              <button
                onClick={() => setViewMode("2d")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all",
                  viewMode === "2d"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MapIcon className="size-3.5" />
                <span>2D GIS</span>
              </button>
            </div>

            <Link
              to="/dispatch"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <span>Unified Dispatch →</span>
            </Link>

            {viewMode === "2d" && (
              <div className="flex flex-wrap items-center gap-1.5">
                {layers.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => toggle(l.key)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      active.includes(l.key)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard className="lg:col-span-2 !p-0 overflow-hidden relative">
            {viewMode === "3d" ? (
              <City3DMap
                height={580}
                selectedIncidentId={selectedIncidentId}
                onSelectIncident={(inc) => setSelectedIncidentId(inc ? inc.id : null)}
              />
            ) : (
              <CityMap height={580} activeLayers={active} />
            )}
          </GlassCard>

          <div className="space-y-4">
            <GlassCard>
              <SectionHeader title="Multi-agent reasoning" />
              <AgentReasoningStream scenarioId="default" compact />
            </GlassCard>
            <GlassCard>
              <ExplainabilityBars title="Congestion attribution · Vytilla" />
            </GlassCard>
          </div>
        </div>

        <GlassCard>
          <SectionHeader
            title="Active incidents on map"
            hint={selectedIncidentId ? "1 incident highlighted on 3D map (click to deselect)" : "Click an incident to focus on 3D map"}
          />
          <ul className="divide-y divide-border">
            {incidents.map((i) => {
              const isSelected = i.id === selectedIncidentId;
              return (
                <li
                  key={i.id}
                  onClick={() => setSelectedIncidentId(isSelected ? null : i.id)}
                  className={cn(
                    "flex flex-wrap items-center gap-3 py-3 px-2 rounded-xl cursor-pointer transition-colors",
                    isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50",
                  )}
                >
                  <SeverityChip severity={i.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{i.location}</p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{i.confidence}%</span>
                  <span className="text-xs text-muted-foreground">{i.minutesAgo}m</span>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      </div>
    </AppShell>
  );
}

