import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GlassCard, SectionHeader } from "@/components/ui-kit";
import { SuggestedPrompts } from "@/components/suggested-prompts";
import { AgentReasoningStream } from "@/components/agent-reasoning-stream";
import { replyFor } from "@/data/kochi";
import { Sparkles, SendHorizonal, Play, Map as MapIcon, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { apiConfig } from "@/config/api";
import { generateGeminiResponse } from "@/lib/gemini";
import { getAssignmentsServerFn, type Assignment } from "@/lib/dispatch";

export const Route = createFileRoute("/copilot")({
  head: () => ({
    meta: [
      { title: "AI Copilot · Kochi | Project Sentinel" },
      { name: "description", content: "Ask Sentinel about Kochi — traffic, floods, dispatch, simulations — with multi-agent reasoning." },
      { property: "og:title", content: "AI Copilot · Sentinel" },
      { property: "og:description", content: "Chat with Sentinel about Kochi's live city state." },
    ],
  }),
  component: CopilotPage,
});

interface Msg { id: string; role: "user" | "assistant"; text: string; reasoning?: boolean }

function CopilotPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "greet", role: "assistant", text: "Hi, I'm **Sentinel**. Ask me anything about Kochi." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages, thinking]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: t }]);
    setInput("");
    setThinking(true);

    // Dynamic Dispatch Query Intelligence
    if (/dispatch|assignment|task|approv|work order|ticket|who is assigned/i.test(t)) {
      try {
        const res: any = await getAssignmentsServerFn({ data: {} });
        const assignments: Assignment[] = Array.isArray(res?.assignments) ? res.assignments : [];
        const open = assignments.filter((a: Assignment) => !["closed", "completed", "cancelled"].includes(a.status));
        const pendingAppr = assignments.filter((a: Assignment) => a.status === "pending_approval");
        const critical = assignments.filter((a: Assignment) => a.priority === "critical" && !["closed", "completed"].includes(a.status));

        let summary = `### Unified Dispatch & Assignment Status (Live Ground Truth)\n\n`;
        summary += `- **Active Open Tasks:** ${open.length}\n`;
        summary += `- **Awaiting Supervisor Approval:** ${pendingAppr.length}\n`;
        summary += `- **Critical P0 Emergencies:** ${critical.length}\n\n`;
        summary += `**Current Key Operations:**\n`;
        summary += open.slice(0, 4).map((a) => `• **${a.id}** [${a.priority.toUpperCase()}]: *${a.title}*\n  ↳ Status: \`${a.status}\` | Unit: **${a.assigned_unit_name || "Unassigned"}** (${a.department_id})`).join("\n");
        summary += `\n\n👉 [Open Dispatch Workspace](/dispatch)`;

        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", text: summary, reasoning: true },
        ]);
        setThinking(false);
        return;
      } catch (e) {
        console.warn("Copilot dispatch query fallback:", e);
      }
    }

    if (apiConfig.gemini.isConfigured) {
      try {
        const reply = await generateGeminiResponse(t);
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", text: reply, reasoning: /vytilla|flood|accident|simulat/i.test(t) },
        ]);
      } catch (err: any) {
        console.error("Gemini copilot error:", err);
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: replyFor(t),
            reasoning: /vytilla|flood|accident|simulat/i.test(t),
          },
        ]);
      } finally {
        setThinking(false);
      }
    } else {
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", text: replyFor(t), reasoning: /vytilla|flood|accident|simulat/i.test(t) },
        ]);
        setThinking(false);
      }, 900);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Analyze · 05</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">AI Copilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask Sentinel anything. It reasons across all city agents.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <GlassCard className="flex flex-col lg:col-span-3 !p-0 overflow-hidden">
            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6 min-h-[420px]">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                  {m.role === "assistant" && (
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                      <Sparkles className="size-4" />
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] space-y-3 rounded-3xl px-4 py-3 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-tr-md bg-primary text-primary-foreground"
                        : "rounded-tl-md bg-secondary text-foreground",
                    )}
                  >
                    <FormattedText text={m.text} />
                    {m.reasoning && m.role === "assistant" && (
                      <div className="rounded-2xl border border-border bg-card p-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Reasoning
                        </p>
                        <AgentReasoningStream compact scenarioId="default" />
                      </div>
                    )}
                    {m.role === "assistant" && m.id !== "greet" && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <ChatChip Icon={MapIcon} label="Show on map" />
                        <ChatChip Icon={Siren} label="Dispatch" />
                        <ChatChip Icon={Play} label="Run simulation" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <Sparkles className="size-4" />
                  </span>
                  <div className="rounded-3xl rounded-tl-md bg-secondary px-4 py-3">
                    <span className="inline-flex gap-1">
                      <span className="size-2 animate-pulse-soft rounded-full bg-muted-foreground" />
                      <span className="size-2 animate-pulse-soft rounded-full bg-muted-foreground [animation-delay:150ms]" />
                      <span className="size-2 animate-pulse-soft rounded-full bg-muted-foreground [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-4">
              <div className="mb-3">
                <SuggestedPrompts onPick={send} />
              </div>
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Message Sentinel about Kochi…"
                  className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
                <Button onClick={() => send(input)} size="icon" className="size-9 shrink-0 rounded-xl">
                  <SendHorizonal className="size-4" />
                </Button>
              </div>
            </div>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard>
              <SectionHeader title="Context" />
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between"><span className="text-muted-foreground">City</span><span className="font-medium">Kochi</span></li>
                <li className="flex items-center justify-between"><span className="text-muted-foreground">Health</span><span className="font-medium text-success">87 / 100</span></li>
                <li className="flex items-center justify-between"><span className="text-muted-foreground">Active alerts</span><span className="font-medium">2 critical · 1 warn</span></li>
                <li className="flex items-center justify-between"><span className="text-muted-foreground">Sensors</span><span className="font-mono text-xs">450 online</span></li>
              </ul>
            </GlassCard>
            <GlassCard>
              <SectionHeader title="Try" />
              <SuggestedPrompts onPick={send} />
            </GlassCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ChatChip({ Icon, label }: { Icon: typeof MapIcon; label: string }) {
  return (
    <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
      <Icon className="size-3" />
      {label}
    </button>
  );
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="opacity-60">•</span>
              <span dangerouslySetInnerHTML={{ __html: format(line.slice(2)) }} />
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return <p key={i} className="pl-1" dangerouslySetInnerHTML={{ __html: format(line) }} />;
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i} dangerouslySetInnerHTML={{ __html: format(line) }} />;
      })}
    </div>
  );
}

function format(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic opacity-80">$1</em>');
}
