import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Radar,
  Siren,
  Sparkles,
  BrainCircuit,
  Rewind,
  Bell,
  Menu,
  MapPin,
  Video,
  Bus,
  ShieldAlert,
  Route as RouteIcon,
  FileText,
  Droplets,
  FlaskConical,
  MessageSquareText,
  ClipboardList,
  SlidersHorizontal,
  HeartPulse,
  Mic,
  Scan,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { NotificationCenter } from "./notification-center";
import { SentinelAssistant } from "./sentinel-assistant";
import { SystemStatusBar } from "./system-status-bar";
import { VoiceCommandBar } from "@/lib/voice";
import { cn } from "@/lib/utils";

interface Stage {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  primary: { to: string; label: string; icon: typeof LayoutDashboard };
  children: { to: string; label: string; icon: typeof LayoutDashboard }[];
}

const stages: Stage[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    primary: { to: "/", label: "Home", icon: LayoutDashboard },
    children: [],
  },
  {
    key: "monitor",
    label: "Monitor",
    icon: Radar,
    primary: { to: "/map", label: "Digital Twin", icon: MapPin },
    children: [
      { to: "/map", label: "Digital Twin", icon: MapPin },
      { to: "/cctv", label: "AI CCTV", icon: Video },
      { to: "/transit", label: "Transit", icon: Bus },
    ],
  },
  {
    key: "respond",
    label: "Respond",
    icon: Siren,
    primary: { to: "/dispatch", label: "Unified Dispatch", icon: Siren },
    children: [
      { to: "/dispatch", label: "Unified Dispatch", icon: Siren },
      { to: "/alerts", label: "AI Alerts", icon: ShieldAlert },
      { to: "/routing", label: "Emergency Routing", icon: RouteIcon },
      { to: "/signal", label: "Signal Control", icon: SlidersHorizontal },
      { to: "/hospital", label: "Hospital Pre-Alert", icon: HeartPulse },
      { to: "/reports", label: "Citizen Reports", icon: ClipboardList },
    ],
  },
  {
    key: "predict",
    label: "Predict",
    icon: Sparkles,
    primary: { to: "/twin", label: "3D Simulation", icon: FlaskConical },
    children: [
      { to: "/twin", label: "3D Simulation", icon: FlaskConical },
      { to: "/simulate", label: "Event Sandbox", icon: FlaskConical },
    ],
  },
  {
    key: "analyze",
    label: "Analyze",
    icon: BrainCircuit,
    primary: { to: "/copilot", label: "Copilot", icon: MessageSquareText },
    children: [
      { to: "/copilot", label: "AI Copilot", icon: MessageSquareText },
      { to: "/reports/executive", label: "Executive Report", icon: FileText },
    ],
  },
];

const advanced: Stage["children"] = [
  { to: "/machine-sight", label: "Machine Sight", icon: Scan },
  { to: "/replay", label: "City Replay", icon: Rewind },
];

function useActiveKey() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/") return { stage: "dashboard", path: "/" };
  for (const s of stages) {
    if (s.children.some((c) => pathname.startsWith(c.to)) || pathname === s.primary.to) {
      return { stage: s.key, path: pathname };
    }
  }
  if (pathname.startsWith("/replay") || pathname.startsWith("/machine-sight")) {
    return { stage: "advanced", path: pathname };
  }
  return { stage: "dashboard", path: pathname };
}

export function AppShell({ children }: { children: ReactNode }) {
  const active = useActiveKey();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <span className="font-display text-sm font-bold">C</span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold tracking-tight">CityTwin AI</p>
            <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
              Kochi Command
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Workflow
          </p>
          <div className="space-y-1">
            {stages.map((stage, i) => (
              <StageGroup key={stage.key} stage={stage} active={active} step={i + 1} />
            ))}
          </div>

          <div>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Advanced Analysis
            </p>
            <div className="space-y-1">
              {advanced.map((item) => (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  Icon={item.icon}
                  active={active.path.startsWith(item.to)}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="px-4 py-2 border-t border-border">
          <Link
            to="/citizen"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 hover:-translate-y-0.5 shadow-md shadow-primary/10"
          >
            <Sparkles className="size-3.5" />
            Switch to Citizen Portal
          </Link>
        </div>

        <div className="border-t border-border p-4">
          <div className="rounded-2xl bg-secondary p-3">
            <div className="flex items-center gap-2">
              <span className="size-2 animate-pulse-soft rounded-full bg-success" />
              <span className="text-xs font-medium">All agents nominal</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Vision AI · Traffic · Weather · Ops</p>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:pl-[264px] lg:pr-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>
          <div className="hidden min-w-0 items-center gap-3 sm:flex">
            <p className="truncate text-sm font-medium">
              {stages.find((s) => s.key === active.stage)?.label ?? "CityTwin AI"}
            </p>
            <span className="hidden text-xs text-muted-foreground lg:inline">·</span>
            <span className="hidden truncate text-xs text-muted-foreground lg:inline">
              Kochi, Kerala · Live
            </span>
          </div>
        </div>

        <div className="hidden flex-1 justify-center px-6 lg:flex">
          <SystemStatusBar compact />
        </div>

        <div className="flex items-center gap-2">
          {/* Operator Voice Command Mic Button */}
          <button
            onClick={() => setVoiceModalOpen(!voiceModalOpen)}
            className={cn(
              "relative grid size-9 place-items-center rounded-xl border transition-colors cursor-pointer shadow-xs",
              voiceModalOpen
                ? "bg-primary text-white border-primary shadow-primary/30"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50"
            )}
            title="Operator Voice Command Bar (Malayalam / English / Manglish)"
            aria-label="Operator Voice Command Bar"
          >
            <Mic className={cn("size-4", voiceModalOpen ? "text-white" : "text-primary")} />
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary animate-pulse" />
          </button>

          <button
            onClick={() => setNotifOpen(true)}
            className="relative grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              3
            </span>
          </button>
          <div className="hidden size-9 rounded-full border border-border bg-secondary lg:block" />
        </div>
      </header>

      {/* Main content area */}
      <main className="pb-32 lg:pb-8 lg:pl-[248px]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] overflow-y-auto bg-card p-6 shadow-2xl animate-rise">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <span className="font-display text-sm font-bold">C</span>
              </div>
              <p className="font-display font-semibold">CityTwin AI</p>
            </div>
            <nav className="space-y-4" onClick={() => setMobileOpen(false)}>
              {stages.map((stage, i) => (
                <StageGroup key={stage.key} stage={stage} active={active} step={i + 1} forceExpand />
              ))}
              <div>
                <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Advanced
                </p>
                {advanced.map((item) => (
                  <SidebarLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    Icon={item.icon}
                    active={active.path.startsWith(item.to)}
                  />
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <Link
                  to="/citizen"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground"
                >
                  <Sparkles className="size-3.5" />
                  Switch to Citizen Portal
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <MobileBottomNav active={active} />

      {/* Globals */}
      <SentinelAssistant />
      <NotificationCenter open={notifOpen} onOpenChange={setNotifOpen} />

      {/* Global Operator Voice Command Modal */}
      {voiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-rise">
          <div className="w-full max-w-2xl relative">
            <VoiceCommandBar variant="modal" onClose={() => setVoiceModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function StageGroup({
  stage,
  active,
  step,
  forceExpand = false,
}: {
  stage: Stage;
  active: { stage: string; path: string };
  step: number;
  forceExpand?: boolean;
}) {
  const isActive = active.stage === stage.key;
  return (
    <div>
      <Link
        to={stage.primary.to}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md font-mono text-[10px]",
            isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          {step}
        </span>
        <span className="flex-1">{stage.label}</span>
      </Link>
      {(isActive || forceExpand) && stage.children.length > 0 && (
        <div className="mt-1 space-y-0.5 border-l border-border pl-3 ml-6">
          {stage.children.map((child) => (
            <SidebarLink
              key={child.to}
              to={child.to}
              label={child.label}
              Icon={child.icon}
              active={active.path === child.to || (child.to !== "/" && active.path.startsWith(child.to + "/"))}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  to,
  label,
  Icon,
  active,
  nested = false,
}: {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  active: boolean;
  nested?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
        active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        nested && "text-[13px]",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function MobileBottomNav({ active }: { active: { stage: string; path: string } }) {
  const items = [
    { key: "dashboard", to: "/", label: "Home", Icon: LayoutDashboard },
    { key: "monitor", to: "/map", label: "Monitor", Icon: Radar },
    { key: "respond", to: "/alerts", label: "Respond", Icon: Siren },
    { key: "predict", to: "/simulate", label: "Simulate", Icon: Sparkles },
    { key: "analyze", to: "/copilot", label: "Analyze", Icon: BrainCircuit },
  ];
  return (
    <nav className="fixed inset-x-2 bottom-2 z-50 lg:hidden">
      <div className="bg-card/98 border border-border/80 flex items-center justify-around rounded-2xl px-2 py-2 shadow-2xl backdrop-blur-2xl">
        {items.map((item) => {
          const isActive = active.stage === item.key;
          return (
            <Link
              key={item.key}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.Icon className="size-4" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
