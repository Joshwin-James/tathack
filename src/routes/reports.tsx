import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlassCard, SectionHeader } from "@/components/ui-kit";
import { useSentinelStore } from "@/lib/store";
import { Camera, Mic, MapPin, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Citizen Reports · Kochi | Project Sentinel" },
      { name: "description", content: "Report issues in Kochi with image, video, voice and GPS. AI verifies and assigns to the right department." },
      { property: "og:title", content: "Citizen Reports · Kochi" },
      { property: "og:description", content: "Citizens report issues; Sentinel verifies and routes them." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [stage, setStage] = useState<"idle" | "verifying" | "verified">("idle");
  const [desc, setDesc] = useState("");
  const { citizenReports, addCitizenReport } = useSentinelStore();

  const startVerify = () => {
    if (!desc.trim()) return;
    setStage("verifying");
    setTimeout(() => {
      setStage("verified");
      addCitizenReport({
        title: "Manual Operator Report",
        citizen: "Sentinel Operator",
        location: "Marine Drive, Kochi",
        priority: "medium",
        department: "Municipal Corp",
        latitude: 9.9788,
        longitude: 76.2789,
        severity: "warning",
        description: desc,
      });
      setDesc("");
    }, 1800);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Respond · 03.c</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Citizen Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Report issues in seconds. Sentinel verifies with vision AI and assigns to the right department.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard className="lg:col-span-1">
            <SectionHeader title="New report" />
            <div className="grid grid-cols-3 gap-2">
              {[
                { Icon: Camera, label: "Photo" },
                { Icon: Upload, label: "Video" },
                { Icon: Mic, label: "Voice" },
              ].map((b) => (
                <button
                  key={b.label}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 hover:bg-secondary cursor-pointer"
                >
                  <b.Icon className="size-5 text-muted-foreground" />
                  <span className="text-xs font-medium">{b.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
              <MapPin className="size-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">Marine Drive, Kochi</p>
                <p className="text-[10px] text-muted-foreground font-mono">9.9788° N, 76.2789° E · GPS locked</p>
              </div>
            </div>

            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe what you're seeing…"
              className="mt-3 w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-primary text-foreground"
              rows={3}
            />

            <Button onClick={startVerify} className="mt-3 w-full cursor-pointer" disabled={stage === "verifying" || !desc.trim()}>
              {stage === "verifying" ? "AI verifying…" : "Submit report"}
            </Button>

            {stage !== "idle" && (
              <div
                className={cn(
                  "mt-3 flex items-start gap-2 rounded-2xl p-3 text-xs",
                  stage === "verified" ? "bg-success/10 text-success" : "bg-accent text-accent-foreground",
                )}
              >
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                <div>
                  {stage === "verifying" ? (
                    <p>Vision AI is checking your submission for duplicates and priority…</p>
                  ) : (
                    <div className="space-y-1 text-foreground">
                      <p className="font-semibold text-success">Verified</p>
                      <p>Assigned to <b>Municipal Corp</b> · priority <b>Medium</b>.</p>
                      <p>Added to the live Command Center queue.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard className="lg:col-span-2">
            <SectionHeader title="Recent reports" hint="Verified by Sentinel Vision AI" />
            <ul className="divide-y divide-border">
              {citizenReports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-secondary text-muted-foreground">
                    <Camera className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.citizen} · {r.location} · {r.minutesAgo}m ago
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      r.priority === "high"
                        ? "bg-destructive/10 text-destructive"
                        : r.priority === "medium"
                          ? "bg-warn/10 text-warn"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {r.priority}
                  </span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                    {r.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.department}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}
