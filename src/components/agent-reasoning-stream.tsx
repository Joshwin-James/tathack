import { useEffect, useState } from "react";
import { agentTranscripts, type AgentMessage } from "@/data/kochi";
import { cn } from "@/lib/utils";

const dotColor: Record<AgentMessage["agent"], string> = {
  "Traffic Agent": "bg-primary",
  "Weather Agent": "bg-chart-5",
  "Emergency Agent": "bg-destructive",
  "Police Agent": "bg-warn",
  "Master AI": "bg-foreground",
};

export function AgentReasoningStream({
  scenarioId = "default",
  compact = false,
  className,
}: {
  scenarioId?: keyof typeof agentTranscripts;
  compact?: boolean;
  className?: string;
}) {
  const messages = agentTranscripts[scenarioId] ?? agentTranscripts.default;
  const [visible, setVisible] = useState<number>(0);

  useEffect(() => {
    setVisible(0);
    const timers = messages.map((m, i) =>
      setTimeout(() => setVisible((v) => Math.max(v, i + 1)), m.ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [scenarioId, messages]);

  return (
    <div className={cn("space-y-3", className)}>
      {messages.map((m, i) => {
        const isMaster = m.agent === "Master AI";
        const shown = i < visible;
        return (
          <div
            key={m.agent + i}
            className={cn(
              "flex gap-3 transition-all duration-500",
              shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              isMaster && "rounded-2xl border border-primary/20 bg-accent/60 p-3",
            )}
          >
            <span
              className={cn(
                "mt-1 size-2 shrink-0 rounded-full",
                dotColor[m.agent],
                shown && !isMaster && "animate-pulse-soft",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "text-xs font-semibold",
                    isMaster ? "text-primary" : "text-foreground",
                  )}
                >
                  {m.agent}
                </p>
                {!shown && (
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    thinking…
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "text-muted-foreground",
                  compact ? "text-xs" : "text-[13px] leading-relaxed",
                  isMaster && "text-foreground",
                )}
              >
                {shown ? m.text : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
