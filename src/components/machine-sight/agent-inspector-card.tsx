// Floating Agent Inspector Card matching the reference video layout and typography
import React from "react";
import { PerceptionAgent } from "@/lib/sim/perception";
import { X } from "lucide-react";

interface AgentInspectorCardProps {
  agent: PerceptionAgent | null;
  onClose: () => void;
}

export function AgentInspectorCard({ agent, onClose }: AgentInspectorCardProps) {
  if (!agent) return null;

  const isAlert = agent.statusBadge === "ALERT";
  const isWait = agent.statusBadge === "WAIT";

  return (
    <div className="pointer-events-auto absolute right-8 top-24 z-40 w-96 overflow-hidden rounded-2xl border border-slate-700/60 bg-white/95 text-slate-900 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 dark:bg-slate-950/95 dark:text-slate-100">
      {/* Top Banner with Semantic Status Color */}
      <div
        className={`relative p-4 transition-colors ${
          isAlert
            ? "bg-rose-500 text-white"
            : isWait
            ? "bg-sky-500 text-white"
            : "bg-emerald-400 text-slate-950 font-medium"
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider ${
              isAlert || isWait
                ? "bg-white/20 text-white"
                : "bg-slate-950/10 text-slate-950"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isAlert ? "bg-white animate-ping" : isWait ? "bg-white" : "bg-slate-950"
              }`}
            />
            {agent.statusBadge}
          </span>

          <button
            onClick={onClose}
            className={`grid size-6 place-items-center rounded-lg transition ${
              isAlert || isWait
                ? "text-white/80 hover:bg-white/20 hover:text-white"
                : "text-slate-950/70 hover:bg-slate-950/10 hover:text-slate-950"
            }`}
            title="Deselect (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Large Headline Title */}
        <h2 className="mt-2 text-xl font-bold tracking-tight">{agent.headline}</h2>
        {/* Descriptive sentence */}
        <p className={`mt-1 text-xs leading-relaxed ${isAlert || isWait ? "text-white/90" : "text-slate-900/80"}`}>
          {agent.explanation}
        </p>
      </div>

      {/* Monospace Data Table */}
      <div className="space-y-2.5 p-4 font-mono text-[12px] bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800/80">
          <span className="text-slate-400">ID:</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {agent.typeLabel} · <span className="underline decoration-cyan-500">{agent.label}</span>
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">speed:</span>
          <span className="font-bold text-cyan-600 dark:text-cyan-400">{agent.speedKmh} km/h</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">intent:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {agent.turnIntent.yielding > 0 ? (
              <span className="text-amber-500 font-semibold">shoulder yield {agent.turnIntent.yielding}%</span>
            ) : (
              `straight ${agent.turnIntent.straight}% · left ${agent.turnIntent.left}%`
            )}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">signal:</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{agent.signalCountdown}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">range:</span>
          <span className="text-slate-700 dark:text-slate-300">{agent.distToNextJunctionM} m from node</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">approach:</span>
          <span className="text-slate-700 dark:text-slate-300">{agent.approachName}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">following:</span>
          <span className="text-slate-700 dark:text-slate-300">{agent.followingText}</span>
        </div>

        {agent.type !== "ambulance" && (
          <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 dark:border-slate-800/80">
            <span className="text-slate-400">dist to emergency:</span>
            <span className="font-bold text-orange-600 dark:text-orange-400">
              {Math.round(agent.distToAmbulance * 4.5)} m
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/80 bg-slate-100/70 px-4 py-2 text-center text-[10px] font-mono text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
        Click empty ground or press Esc to release
      </div>
    </div>
  );
}
