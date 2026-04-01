import { PHASE_ORDER, PHASE_LABELS } from "@/lib/debate/phases";
import type { DebatePhase } from "@/types";

interface PhaseIndicatorProps {
  currentPhase: DebatePhase | "waiting" | "complete";
  completedPhases: Set<string>;
}

const PHASE_COLORS: Record<string, { dot: string; active: string; complete: string; line: string }> = {
  opening: {
    dot: "bg-side-a",
    active: "bg-side-a/10 text-side-a ring-1 ring-side-a/30",
    complete: "bg-side-a/10 text-side-a/60",
    line: "bg-side-a/40",
  },
  response: {
    dot: "bg-side-b",
    active: "bg-side-b/10 text-side-b ring-1 ring-side-b/30",
    complete: "bg-side-b/10 text-side-b/60",
    line: "bg-side-b/40",
  },
  ruling: {
    dot: "bg-judge",
    active: "bg-judge/10 text-judge ring-1 ring-judge/30",
    complete: "bg-judge/10 text-judge/60",
    line: "bg-judge/40",
  },
};

export function PhaseIndicator({
  currentPhase,
  completedPhases,
}: PhaseIndicatorProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
      {PHASE_ORDER.filter((p) => p !== "extraction").map((phase, i) => {
        const isComplete = completedPhases.has(phase);
        const isCurrent = currentPhase === phase;
        const colors = PHASE_COLORS[phase];

        return (
          <div key={phase} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && (
              <div
                className={`hidden sm:block w-6 h-px transition-colors ${
                  isComplete ? colors?.line || "bg-zinc-600" : "bg-zinc-800"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                isCurrent
                  ? colors?.active || "bg-white/10 text-white ring-1 ring-white/20"
                  : isComplete
                    ? colors?.complete || "bg-zinc-800 text-zinc-400"
                    : "text-zinc-600"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isCurrent
                    ? `${colors?.dot || "bg-white"} animate-pulse`
                    : isComplete
                      ? colors?.dot || "bg-zinc-500"
                      : "bg-zinc-700"
                }`}
              />
              {PHASE_LABELS[phase]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
