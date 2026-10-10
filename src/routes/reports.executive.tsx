import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Copy, Download, Printer, ArrowUpRight, ShieldAlert, CheckCircle2, Clock, Truck, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { getDispatchMetricsServerFn, getAssignmentsServerFn } from "@/lib/dispatch/server";
import type { DispatchMetrics, Assignment } from "@/lib/dispatch/types";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/executive")({
  head: () => ({
    meta: [
      { title: "Executive Summary · Kochi | Project Sentinel" },
      { name: "description", content: "Executive summary of Kochi city operations: traffic, emergencies, flood risk and AI recommendations." },
      { property: "og:title", content: "Executive Summary · Kochi" },
      { property: "og:description", content: "A daily executive report on Kochi city operations." },
    ],
  }),
  component: ExecutiveReport,
});

function ExecutiveReport() {
  const today = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  const [metrics, setMetrics] = useState<DispatchMetrics | null>(null);
  const [recentAssignments, setRecentAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    Promise.all([
      getDispatchMetricsServerFn().catch(() => null),
      getAssignmentsServerFn({ data: {} }).catch(() => null),
    ]).then(([m, a]: [any, any]) => {
      if (m) setMetrics(m);
      if (a?.assignments && Array.isArray(a.assignments)) {
        setRecentAssignments(a.assignments.slice(0, 6));
      }
    });
  }, []);

  const copyMarkdown = () => {
    const totalCount = metrics?.total || 7;
    const criticalCount = metrics?.critical || 2;
    const openCount = metrics?.open || 5;
    const slaPercent = metrics?.sla_compliance_rate ? Math.round(metrics.sla_compliance_rate * 100) : 94;

    const md = `# Kochi Executive Summary — ${today}
Prepared by Project Sentinel Unified Operations.

## Unified Dispatch & Emergency Work Orders
- Total Dispatches: ${totalCount}
- Active / Open Tasks: ${openCount}
- Critical Priority: ${criticalCount}
- SLA Compliance Rate: ${slaPercent}%

## Traffic Overview
Heavy congestion at Vytilla and Edappally corridors. City-wide flow index 62/100. Sentinel rerouted 1,240 vehicles.

## Emergency Summary
${recentAssignments.map((as) => `- [${as.reference_code}] ${as.title} (${as.status.toUpperCase()}) — ${as.assigned_unit_name || as.assigned_team_name || as.department_id}`).join("\n")}

## Flood Risk
Marine Drive corridor at 62% saturation. Dewatering pumps deployed.

## AI Recommendations
- Reroute NH-66 southbound via Palarivattom bypass
- Add 4 buses on Vytilla ↔ Kakkanad
- Pre-position 2 rescue units at Marine Drive walkway
`;
    navigator.clipboard.writeText(md);
    toast.success("Executive briefing copied to clipboard as Markdown");
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Analyze · 05.b</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Executive Summary</h1>
            <p className="mt-1 text-sm text-muted-foreground">Daily briefing for city leadership. Data-backed by Sentinel Operations Engine.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Link
              to="/dispatch"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <span>Unified Dispatch Board</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={copyMarkdown}>
              <Copy className="size-3.5" /> Copy markdown
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="size-3.5" /> Print
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Download className="size-3.5" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Live Operational Metrics Ribbon (Print-Friendly) */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Active Work Orders</span>
              <p className="text-2xl font-bold font-mono text-foreground mt-0.5">{metrics.open}</p>
              <span className="text-[11px] text-muted-foreground">of {metrics.total} total dispatched</span>
            </div>
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 shadow-2xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-rose-500 font-bold">Critical Emergencies</span>
              <p className="text-2xl font-bold font-mono text-rose-500 mt-0.5">{metrics.critical}</p>
              <span className="text-[11px] text-rose-500/80">Immediate responder response</span>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 shadow-2xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 font-bold">Awaiting Supervisor</span>
              <p className="text-2xl font-bold font-mono text-amber-500 mt-0.5">{metrics.awaiting_approval}</p>
              <span className="text-[11px] text-amber-500/80">Pending formal sign-off</span>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 shadow-2xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-500 font-bold">SLA Compliance</span>
              <p className="text-2xl font-bold font-mono text-emerald-500 mt-0.5">{Math.round(metrics.sla_compliance_rate * 100)}%</p>
              <span className="text-[11px] text-emerald-500/80">Avg response &lt; 8.5 mins</span>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          <GlassCard className="!p-10">
            <div className="border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Kochi Municipal · Unified Command Report
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold">Daily Executive Summary</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{today}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sentinel Operations Engine</p>
                </div>
              </div>
            </div>

            <Section title="Unified Dispatch & Work Assignment Operations">
              <p>
                The central dispatch engine has processed <b>{metrics?.total ?? 7} operational assignments</b> across 6 city agencies.
                Currently <b>{metrics?.in_progress ?? 3} units are active on-scene</b> and <b>{metrics?.critical ?? 2} critical incidents</b> have active emergency corridors assigned.
              </p>
              <div className="mt-3 divide-y divide-border/60 rounded-xl border border-border/60 bg-secondary/30 text-xs">
                {recentAssignments.map((as) => (
                  <div key={as.id} className="flex items-center justify-between p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground text-[11px]">{as.reference_code}</span>
                      <span className="text-foreground/90 font-medium">{as.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono text-[10px]">{as.assigned_unit_name || as.department_id}</span>
                      <span className="rounded px-2 py-0.5 font-mono text-[9px] uppercase font-bold bg-secondary text-foreground">
                        {as.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Traffic Overview">
              <p>
                Heavy congestion recorded at <b>Vytilla Junction</b> (+48% vs baseline) and <b>Edappally NH-66</b> (+62%).
                City-wide flow index sits at <b>62/100</b>. Sentinel rerouted <b>1,240 vehicles</b> during peak hours; average commute
                time reduced by <b>7 minutes</b>.
              </p>
            </Section>

            <Section title="Emergency Summary">
              <ul className="ml-5 list-disc space-y-1">
                <li>Multi-vehicle collision at Kundannoor — Ambulance K-14 dispatched, green corridor active.</li>
                <li>Container truck overturned NH-66 Edappally — Fire unit F-3 en route, lanes 2-3 closed.</li>
                <li>All 4 medium/low incidents assigned to responsible departments within 3 minutes.</li>
              </ul>
            </Section>

            <Section title="Flood Risk">
              <p>
                Marine Drive corridor at <b>62%</b> catchment saturation. Sentinel recommends closing the north lane by 6:30 PM.
                Two rescue units pre-positioned. Kaloor and MG Road elevated to watch level.
              </p>
            </Section>

            <Section title="AI Recommendations">
              <ul className="ml-5 list-disc space-y-1">
                <li>Reroute NH-66 southbound via Palarivattom bypass through peak evening.</li>
                <li>Add 4 buses on Vytilla ↔ Kakkanad; increase Blue-line metro frequency to 4 min.</li>
                <li>Push citizen advisory for Marine Drive corridor now.</li>
                <li>Approve overtime for 12 traffic officers at Vytilla + Aluva stations.</li>
              </ul>
            </Section>

            <div className="mt-8 border-t border-border pt-4 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Confidential · For internal city government use only</span>
              <span>Audited by Sentinel Engine</span>
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-primary">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}
