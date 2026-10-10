import { Link } from "@tanstack/react-router";
import { Video, ClipboardPlus, FlaskConical, Siren, MessageSquareText, Layers } from "lucide-react";

const actions = [
  { to: "/dispatch", label: "Unified Dispatch", Icon: Siren, tone: "bg-destructive/15 text-destructive" },
  { to: "/twin", label: "3D Simulation", Icon: Layers, tone: "bg-primary/10 text-primary" },
  { to: "/cctv", label: "Open CCTV", Icon: Video, tone: "bg-secondary" },
  { to: "/reports", label: "Citizen Reports", Icon: ClipboardPlus, tone: "bg-secondary" },
  { to: "/simulate", label: "Event Sandbox", Icon: FlaskConical, tone: "bg-secondary" },
  { to: "/copilot", label: "AI Copilot", Icon: MessageSquareText, tone: "bg-accent text-accent-foreground" },
];

export function QuickActionsGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {actions.map(({ to, label, Icon, tone }) => (
        <Link
          key={to}
          to={to}
          className={`group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${tone.includes("bg-destructive") ? "" : ""}`}
        >
          <span className={`grid size-10 place-items-center rounded-xl ${tone}`}>
            <Icon className="size-4" />
          </span>
          <span className="text-sm font-medium leading-tight">{label}</span>
        </Link>
      ))}
    </div>
  );
}
