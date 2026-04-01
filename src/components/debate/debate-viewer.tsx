"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { PhaseIndicator } from "./phase-indicator";
import { PhaseSection } from "./phase-section";
import type { Debate, DebateEvent, DebatePhase, Speaker } from "@/types";

interface Turn {
  speaker: Speaker;
  content: string;
  isStreaming?: boolean;
}

interface PhaseData {
  phase: DebatePhase;
  turns: Turn[];
  isComplete: boolean;
}

const DEBATE_PHASES: DebatePhase[] = ["opening", "response", "ruling"];

export function DebateViewer({ debateId }: { debateId: string }) {
  const [phases, setPhases] = useState<Map<DebatePhase, PhaseData>>(new Map());
  const [currentPhase, setCurrentPhase] = useState<DebatePhase | "waiting" | "complete">("waiting");
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [copied, setCopied] = useState(false);
  const isRunningRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only when user is near the bottom (not if they've scrolled up)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 150) {
      el.scrollTop = el.scrollHeight;
    }
  }, [phases, currentPhase]);

  const startPhaseStream = useCallback(
    (phase: string) => {
      return new Promise<void>((resolve, reject) => {
        const es = new EventSource(`/api/debate/${debateId}/stream?phase=${phase}`);
        let streamCompleted = false;

        es.onmessage = (event) => {
          try {
            const data: DebateEvent = JSON.parse(event.data);

            switch (data.type) {
              case "phase_start":
                // Don't update UI phase for extraction — it runs silently
                if (data.phase !== "extraction") {
                  setCurrentPhase(data.phase);
                  setPhases((prev) => {
                    const next = new Map(prev);
                    next.set(data.phase, {
                      phase: data.phase,
                      turns: [],
                      isComplete: false,
                    });
                    return next;
                  });
                }
                break;

              case "extraction_complete":
                break;

              case "text_delta":
                // Skip rendering extraction text deltas
                if (phase === "extraction") break;

                setPhases((prev) => {
                  const next = new Map(prev);
                  const phaseKey =
                    data.speaker === "judge"
                      ? "ruling"
                      : (phase as DebatePhase);
                  const phaseData = next.get(phaseKey) || {
                    phase: phaseKey,
                    turns: [],
                    isComplete: false,
                  };

                  const turns = [...phaseData.turns];
                  const lastTurn = turns[turns.length - 1];

                  if (lastTurn && lastTurn.speaker === data.speaker && lastTurn.isStreaming) {
                    turns[turns.length - 1] = {
                      ...lastTurn,
                      content: lastTurn.content + data.content,
                    };
                  } else {
                    turns.push({
                      speaker: data.speaker,
                      content: data.content,
                      isStreaming: true,
                    });
                  }

                  next.set(phaseKey, { ...phaseData, turns });
                  return next;
                });
                break;

              case "turn_complete":
                if (phase === "extraction") break;

                setPhases((prev) => {
                  const next = new Map(prev);
                  for (const [key, phaseData] of next) {
                    const lastTurn = phaseData.turns[phaseData.turns.length - 1];
                    if (lastTurn?.speaker === data.speaker && lastTurn.isStreaming) {
                      const turns = [...phaseData.turns];
                      turns[turns.length - 1] = { ...lastTurn, isStreaming: false };
                      next.set(key, { ...phaseData, turns });
                      break;
                    }
                  }
                  return next;
                });
                break;

              case "phase_complete":
                streamCompleted = true;
                if (data.phase !== "extraction") {
                  setPhases((prev) => {
                    const next = new Map(prev);
                    const phaseData = next.get(data.phase);
                    if (phaseData) {
                      next.set(data.phase, { ...phaseData, isComplete: true });
                    }
                    return next;
                  });
                }
                break;

              case "debate_complete":
                streamCompleted = true;
                setIsComplete(true);
                setCurrentPhase("complete");
                es.close();
                resolve();
                return;

              case "error":
                setError(data.message);
                es.close();
                reject(new Error(data.message));
                return;
            }
          } catch (err) {
            console.error("Failed to parse SSE event:", err);
            setError("Lost connection to the debate stream. Please refresh the page.");
            es.close();
            reject(new Error("SSE parse failure"));
          }
        };

        es.onerror = () => {
          es.close();
          if (streamCompleted) {
            resolve();
          } else {
            reject(new Error(`Connection lost during phase: ${phase}`));
          }
        };
      });
    },
    [debateId]
  );

  const runAllPhases = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      const res = await fetch(`/api/debate/${debateId}`);
      if (!res.ok) {
        throw new Error(`Failed to load debate: HTTP ${res.status}`);
      }
      const debate: Debate = await res.json();

      // Load any completed phases (skip extraction for display)
      if (debate.phases && debate.phases.length > 0) {
        const loaded = new Map<DebatePhase, PhaseData>();
        for (const p of debate.phases) {
          if (p.phase === "extraction") continue;
          loaded.set(p.phase, {
            phase: p.phase,
            turns: p.turns.map((t) => ({
              speaker: t.speaker,
              content: t.content,
              isStreaming: false,
            })),
            isComplete: p.status === "complete",
          });
        }
        setPhases(loaded);
      }

      if (debate.status === "completed") {
        setIsComplete(true);
        setCurrentPhase("complete");
        return;
      }

      const completedPhaseNames = new Set(
        (debate.phases || [])
          .filter((p) => p.status === "complete")
          .map((p) => p.phase)
      );

      // Run extraction silently if needed
      if (!debate.position_a || !debate.position_b) {
        await startPhaseStream("extraction");
      }

      // Run visible debate phases
      for (const phase of DEBATE_PHASES) {
        if (completedPhaseNames.has(phase)) continue;
        await startPhaseStream(phase);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      isRunningRef.current = false;
    }
  }, [debateId, startPhaseStream]);

  useEffect(() => {
    runAllPhases();
  }, [runAllPhases]);

  const completedPhases = new Set(
    [...phases.entries()]
      .filter(([, data]) => data.isComplete)
      .map(([key]) => key)
  );

  // Extract verdict from judge's ruling (last bold line)
  const judgeRuling = phases.get("ruling");
  const verdict = judgeRuling?.isComplete
    ? extractVerdict(judgeRuling.turns.find((t) => t.speaker === "judge")?.content || "")
    : null;

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="text-lg font-bold hover:text-zinc-300 transition-colors">
              Both Takes
            </Link>
            <div className="flex gap-2">
              {isComplete && (
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 text-xs rounded-full border border-border hover:border-zinc-500 transition-colors"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              )}
              <Link
                href="/"
                className="px-3 py-1.5 text-xs rounded-full border border-border hover:border-zinc-500 transition-colors"
              >
                New Debate
              </Link>
            </div>
          </div>
          <PhaseIndicator
            currentPhase={currentPhase}
            completedPhases={completedPhases}
          />
        </div>
      </div>

      {/* Debate content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* TL;DR Card — shown when debate is complete */}
          {isComplete && verdict && (
            <div className="mb-8 p-6 rounded-xl bg-judge-dim/20 border border-judge/20">
              <div className="text-xs font-semibold text-judge uppercase tracking-wider mb-2">
                Verdict
              </div>
              <p className="text-base font-medium text-zinc-100 leading-relaxed">
                {verdict}
              </p>
              <p className="text-xs text-zinc-500 mt-3">Read the full debate below</p>
            </div>
          )}

          {/* Render visible debate phases (extraction is hidden) */}
          {DEBATE_PHASES.map((phase) => {
            const phaseData = phases.get(phase);
            if (!phaseData && currentPhase !== phase) return null;

            return (
              <PhaseSection
                key={phase}
                phase={phase}
                turns={phaseData?.turns || []}
                isActive={currentPhase === phase}
              />
            );
          })}

          {/* Waiting state — shown during silent extraction */}
          {(currentPhase === "waiting" || currentPhase === "extraction") && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mb-4" />
              <p className="text-sm">Analyzing both sides...</p>
            </div>
          )}

          {/* Completion state */}
          {isComplete && (
            <div className="text-center py-8 text-zinc-500 text-sm">
              <p>Debate complete. Share this page to let others see the full deliberation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Extract the verdict line from the judge's ruling (text after "**Verdict:**") */
function extractVerdict(content: string): string | null {
  // Look for **Verdict:** or **Verdict** pattern
  const match = content.match(/\*\*Verdict:?\*\*\s*([\s\S]+)/);
  if (match) {
    // Clean up any remaining markdown bold markers
    return match[1].trim().replace(/\*\*/g, "");
  }
  return null;
}
