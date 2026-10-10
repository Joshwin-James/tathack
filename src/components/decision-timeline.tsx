import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { decisionSteps } from "@/data/kochi";

export function DecisionTimeline({
  activeStep = 5,
  orientation = "auto",
  className,
}: {
  activeStep?: number;
  orientation?: "vertical" | "horizontal" | "auto";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3",
        orientation === "horizontal" && "flex-row items-start",
        orientation === "vertical" && "flex-col",
        orientation === "auto" && "flex-col lg:flex-row lg:items-start",
        className,
      )}
    >
      {decisionSteps.map((step, i) => {
        const done = i < activeStep;
        const current = i === activeStep;
        return (
          <div
            key={step}
            className={cn(
              "flex min-w-0 items-start gap-3",
              orientation !== "vertical" && "lg:flex-1 lg:flex-col lg:items-start",
            )}
          >
            <div className="flex flex-col items-center lg:flex-row lg:items-center lg:gap-2 lg:w-full">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  current && "bg-accent text-accent-foreground ring-2 ring-primary ring-offset-2 ring-offset-background",
                  !done && !current && "bg-secondary text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              {i < decisionSteps.length - 1 && (
                <span
                  className={cn(
                    "h-6 w-px shrink-0 lg:h-px lg:flex-1",
                    done ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
            <div className="min-w-0 pb-4 lg:pb-0 lg:pt-2">
              <p className={cn("text-xs font-semibold", current ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")}>
                {step}
              </p>
              {current && (
                <p className="text-[10px] uppercase tracking-widest text-primary">In progress</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
