import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlassCard, SectionHeader } from "@/components/ui-kit";
import { replayTimeline } from "@/data/kochi";
import { useState } from "react";
import { Rewind } from "lucide-react";

export const Route = createFileRoute("/replay")({
  head: () => ({
    meta: [
      { title: "City Replay · Advanced Analysis | Project Sentinel" },
      { name: "description", content: "Advanced replay of Kochi city events with actual vs AI-recommended response comparison." },
      { property: "og:title", content: "City Replay · Sentinel" },
      { property: "og:description", content: "Replay Kochi's day and compare actual vs AI response." },
    ],
  }),
  component: ReplayPage,
});

function ReplayPage() {
  const [idx, setIdx] = useState(0);
  const event = replayTimeline[idx];
  const saved = event.actualLatencyMin - event.aiLatencyMin;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Advanced Analysis</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight flex items-center gap-3">
            <Rewind className="size-6" /> City Replay
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scrub through the last 24 hours. Compare what happened with what Sentinel would have recommended.
          </p>
        </div>

        <GlassCard>
          <SectionHeader title="Timeline" hint={`${event.time} · ${event.label}`} />
          <input
            type="range"
            min={0}
            max={replayTimeline.length - 1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            {replayTimeline.map((r, i) => (
              <span key={r.time} className={i === idx ? "font-semibold text-primary" : ""}>
                {r.time}
              </span>
            ))}
          </div>
        </GlassCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard>
            <SectionHeader title="Actual response" hint="Recorded from Kochi ops logs" />
            <p className="font-display text-3xl font-semibold">{event.actualLatencyMin}m</p>
            <p className="mt-1 text-xs text-muted-foreground">Time to first responder action</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>· Manual signal escalation via ops control</li>
              <li>· Ambulance routed on shortest path (no priority)</li>
              <li>· Citizen advisory pushed 12 min after event</li>
            </ul>
          </GlassCard>
          <GlassCard className="border-primary/40 bg-accent/40">
            <SectionHeader title="Sentinel recommendation" hint="Simulated in retrospect" />
            <p className="font-display text-3xl font-semibold text-primary">{event.aiLatencyMin}m</p>
            <p className="mt-1 text-xs text-success">
              -{saved}m faster · {Math.round((saved / event.actualLatencyMin) * 100)}% improvement
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>· Green corridor activated automatically</li>
              <li>· Multi-agent dispatch (ambulance + police + signals)</li>
              <li>· Citizen advisory pushed in under 60 seconds</li>
            </ul>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}
