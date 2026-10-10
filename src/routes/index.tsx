import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Circle, Droplets, Flame, TrendingUp, FileText } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { HealthRing } from "@/components/health-ring";
import { CityMap } from "@/components/city-map";
import { QuickActionsGrid } from "@/components/quick-actions-grid";
import { SystemStatusBar } from "@/components/system-status-bar";
import { GlassCard, LiveBadge, MetricTile, SectionHeader, SeverityChip } from "@/components/ui-kit";
import { dailyBrief } from "@/data/kochi";
import { useSentinelStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const briefIcon = { critical: Flame, predict: TrendingUp, flood: Droplets, peak: Circle } as const;

function HomePage() {
  const { incidents, recentDecisions } = useSentinelStore();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <div className="space-y-6 animate-rise">
        {/* Greeting header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{greeting},</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight lg:text-4xl">
              Kochi Command Center
            </h1>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-success" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              <span className="font-medium text-success">AI Monitoring Active</span>
            </div>
          </div>
          <Link
            to="/reports/executive"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
          >
            <FileText className="size-4" />
            Generate Executive Summary
          </Link>
        </div>

        {/* Status bar visible on mobile too */}
        <div className="lg:hidden">
          <SystemStatusBar />
        </div>

        {/* Hero row: Health + Brief */}
        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard className="flex flex-col items-center justify-center gap-4 py-8 lg:col-span-1">
            <HealthRing value={87} size={180} />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Kochi is running smoothly</p>
              <p className="text-xs text-success">+3 pts from yesterday</p>
            </div>
          </GlassCard>

          <GlassCard className="lg:col-span-2">
            <SectionHeader title="Today's AI Brief" hint="Auto-generated from 450+ sensors and 12 agents" action={<LiveBadge />} />
            <ul className="space-y-2">
              {dailyBrief.map((b) => {
                const Icon = briefIcon[b.icon as keyof typeof briefIcon];
                return (
                  <li key={b.label}>
                    <Link
                      to={b.href}
                      className="group flex items-center gap-3 rounded-2xl border border-transparent p-3 transition-colors hover:border-border hover:bg-secondary/60"
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-4" />
                      </span>
                      <p className="flex-1 text-sm">{b.label}</p>
                      <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <MetricTile label="Traffic" value="Heavy" hint="Vytilla, Edappally" tone="warn" />
              <MetricTile label="Air Quality" value="Good (42)" hint="Kochi Central AQI" tone="success" />
              <MetricTile label="Emergency" value="2 active" hint="Both dispatched" tone="danger" />
            </div>
          </GlassCard>
        </div>

        {/* Quick actions */}
        <div>
          <SectionHeader title="Quick actions" hint="Jump straight into the workflow" />
          <QuickActionsGrid />
        </div>

        {/* Map + right column */}
        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard className="lg:col-span-2">
            <SectionHeader
              title="Digital Twin · Kochi"
              hint="Live digital twin telemetry & incident map"
              action={
                <Link to="/map" className="text-xs font-medium text-primary hover:underline">
                  Open full map →
                </Link>
              }
            />
            <CityMap height={340} />
          </GlassCard>

          <GlassCard>
            <SectionHeader title="Recent AI decisions" />
            <ul className="space-y-3">
              {recentDecisions.map((d) => (
                <li key={d.id} className="rounded-2xl border border-border p-3">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-foreground">{d.agent}</span>
                    <span className="text-muted-foreground">{d.time} ago</span>
                  </div>
                  <p className="mt-1 text-sm">{d.action}</p>
                  <span className="mt-2 inline-flex rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-foreground">
                    {d.outcome}
                  </span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>

        {/* Live incidents */}
        <GlassCard>
          <SectionHeader
            title="Live incidents"
            hint={`${incidents.filter((i) => i.severity !== "resolved").length} active`}
            action={<Link to="/alerts" className="text-xs font-medium text-primary hover:underline">All alerts →</Link>}
          />
          <ul className="divide-y divide-border">
            {incidents.slice(0, 5).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                <SeverityChip severity={i.severity} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {i.location} · {i.department} · {i.confidence}% confidence
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{i.minutesAgo}m ago</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </AppShell>
  );
}
