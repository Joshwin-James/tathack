import { suggestedPrompts } from "@/data/kochi";

export function SuggestedPrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestedPrompts.map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
