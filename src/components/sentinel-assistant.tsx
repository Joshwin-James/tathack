import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, X, ArrowUpRight, SendHorizonal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SuggestedPrompts } from "./suggested-prompts";
import { replyFor } from "@/data/kochi";
import { cn } from "@/lib/utils";
import { apiConfig } from "@/config/api";
import { generateGeminiResponse } from "@/lib/gemini";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export function SentinelAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id: "greet", role: "assistant", text: "Hi — I'm **CityTwin AI**. Ask me about Kochi traffic, floods, incidents, or run a quick simulation." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: t };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);

    if (apiConfig.gemini.isConfigured) {
      try {
        const reply = await generateGeminiResponse(t);
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: reply }]);
      } catch (err: any) {
        console.error("Gemini assistant error:", err);
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: replyFor(t) }]);
      } finally {
        setThinking(false);
      }
    } else {
      setTimeout(() => {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: replyFor(t) }]);
        setThinking(false);
      }, 600);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 hidden items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground electric-shadow transition-transform hover:scale-105 lg:right-6 lg:bottom-6 lg:inline-flex"
        aria-label="Ask CityTwin AI"
      >
        <Sparkles className="size-4" />
        <span>Ask CityTwin AI</span>
        <span className="rounded-md bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">⌘K</span>
      </button>

      {/* Mobile floating button — appears above bottom nav */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground electric-shadow lg:hidden"
        aria-label="Ask CityTwin AI"
      >
        <Sparkles className="size-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 border-l border-border bg-card p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-3.5" />
                </span>
                Ask CityTwin AI
              </SheetTitle>
              <Link
                to="/copilot"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground hover:text-primary"
              >
                Open full Copilot
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </SheetHeader>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}
            {thinking && (
              <div className="flex gap-2">
                <span className="grid size-6 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-3" />
                </span>
                <div className="rounded-2xl rounded-tl-sm bg-secondary px-3 py-2">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-pulse-soft rounded-full bg-muted-foreground" />
                    <span className="size-1.5 animate-pulse-soft rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="size-1.5 animate-pulse-soft rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            {messages.length === 1 && !thinking && (
              <div className="pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Try
                </p>
                <SuggestedPrompts onPick={send} />
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
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
                placeholder="Ask about Kochi…"
                className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button size="icon" onClick={() => send(input)} className="size-8 shrink-0 rounded-xl">
                <SendHorizonal className="size-3.5" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      {!isUser && (
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-3" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-secondary text-foreground",
        )}
      >
        <FormattedText text={msg.text} />
      </div>
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  // Minimal markdown: **bold** + lists + line breaks
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-muted-foreground">•</span>
              <span dangerouslySetInnerHTML={{ __html: bold(line.slice(2)) }} />
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i} dangerouslySetInnerHTML={{ __html: bold(line) }} />;
      })}
    </div>
  );
}

function bold(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic opacity-80">$1</em>');
}
