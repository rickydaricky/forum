import { PHASE_LABELS } from "@/lib/debate/phases";
import { MessageBubble } from "./message-bubble";
import type { DebatePhase, Speaker } from "@/types";

interface Turn {
  speaker: Speaker;
  content: string;
  isStreaming?: boolean;
}

interface PhaseSectionProps {
  phase: DebatePhase;
  turns: Turn[];
  isActive: boolean;
}

export function PhaseSection({ phase, turns, isActive }: PhaseSectionProps) {
  if (turns.length === 0 && !isActive) return null;

  const isJudgePhase = phase === "ruling";

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          {PHASE_LABELS[phase]}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      {isJudgePhase ? (
        // Judge ruling: single centered card
        <div className="space-y-4">
          {turns.map((turn, i) => (
            <MessageBubble
              key={i}
              speaker={turn.speaker}
              content={turn.content}
              isStreaming={turn.isStreaming}
            />
          ))}
        </div>
      ) : (
        // Advocates: two-column layout
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={
                turn.speaker === "advocate_b" ? "md:col-start-2" : ""
              }
            >
              <MessageBubble
                speaker={turn.speaker}
                content={turn.content}
                isStreaming={turn.isStreaming}
              />
            </div>
          ))}
        </div>
      )}

      {isActive && turns.length === 0 && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            Processing...
          </div>
        </div>
      )}
    </div>
  );
}
