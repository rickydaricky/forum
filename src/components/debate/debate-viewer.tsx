"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PhaseIndicator } from "./phase-indicator";
import { PhaseSection } from "./phase-section";
import type { DebatePhase, Speaker } from "@/types";

interface Turn {
  speaker: Speaker;
  content: string;
}

interface PhaseData {
  phase: DebatePhase;
  turns: Turn[];
  isComplete: boolean;
}

const DEBATE_PHASES: DebatePhase[] = ["opening", "response", "ruling"];

/**
 * DebateViewer — read-only observer that connects to the SSE stream endpoint.
 * All debate generation happens server-side. This component just renders events.
 */
export function DebateViewer({ debateId }: { debateId: string }) {
  const [phases, setPhases] = useState<Map<DebatePhase, PhaseData>>(new Map());
  const [currentPhase, setCurrentPhase] = useState<DebatePhase | "waiting" | "complete">("waiting");
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [waitingForSideB, setWaitingForSideB] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedVerdict, setCopiedVerdict] = useState(false);
  const [inputA, setInputA] = useState<string | null>(null);
  const [inputB, setInputB] = useState<string | null>(null);
  const [showInputs, setShowInputs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only when user is near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 150) {
      el.scrollTop = el.scrollHeight;
    }
  }, [phases, currentPhase]);

  // Single SSE connection — all state comes from server events
  useEffect(() => {
    const es = new EventSource(`/api/debate/${debateId}/stream`);
    let connectionErrorCount = 0;
    let parseErrorCount = 0;

    es.onmessage = (event) => {
      connectionErrorCount = 0; // Reset on successful message
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "waiting_for_side_b":
            setWaitingForSideB(true);
            break;

          case "phase_start":
            setWaitingForSideB(false);
            setCurrentPhase(data.phase as DebatePhase);
            setPhases((prev) => {
              const next = new Map(prev);
              if (!next.has(data.phase)) {
                next.set(data.phase, {
                  phase: data.phase,
                  turns: [],
                  isComplete: false,
                });
              }
              return next;
            });
            break;

          case "turn":
            setPhases((prev) => {
              const next = new Map(prev);
              const phaseData = next.get(data.phase) || {
                phase: data.phase,
                turns: [],
                isComplete: false,
              };
              // Only add if we don't already have this turn
              const alreadyHas = phaseData.turns.some(
                (t) => t.speaker === data.speaker && t.content === data.content
              );
              if (!alreadyHas) {
                next.set(data.phase, {
                  ...phaseData,
                  turns: [...phaseData.turns, { speaker: data.speaker, content: data.content }],
                });
              }
              return next;
            });
            break;

          case "phase_complete":
            setPhases((prev) => {
              const next = new Map(prev);
              const phaseData = next.get(data.phase);
              if (phaseData) {
                next.set(data.phase, { ...phaseData, isComplete: true });
              }
              return next;
            });
            break;

          case "debate_complete":
            setIsComplete(true);
            setCurrentPhase("complete");
            if (data.inputA) setInputA(data.inputA);
            if (data.inputB) setInputB(data.inputB);
            es.close();
            break;

          case "error":
            setError(data.message);
            es.close();
            break;
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err, "Raw:", event.data);
        parseErrorCount++;
        if (parseErrorCount >= 3) {
          setError("Having trouble receiving updates. Try refreshing the page.");
        }
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects. Track consecutive errors.
      connectionErrorCount++;
      if (connectionErrorCount >= 5) {
        setError("Connection lost. Please refresh the page.");
        es.close();
      }
    };

    return () => {
      es.close();
    };
  }, [debateId]);

  const completedPhases = new Set(
    [...phases.entries()]
      .filter(([, data]) => data.isComplete)
      .map(([key]) => key)
  );

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
      () => {
        window.prompt("Copy this link:", window.location.href);
      }
    );
  }

  async function handleShareVerdict() {
    const shareText = `AI settled our argument: "${verdict}"`;
    const url = window.location.href;

    // Use native share sheet on mobile (iOS Safari, Android Chrome, etc.)
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Fallback: copy formatted text to clipboard
    const clipboardText = `${shareText} See the full debate → ${url}`;
    navigator.clipboard.writeText(clipboardText).then(
      () => {
        setCopiedVerdict(true);
        setTimeout(() => setCopiedVerdict(false), 2000);
      },
      () => {
        window.prompt("Copy this message:", clipboardText);
      }
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
              {isComplete && verdict && (
                <button
                  onClick={handleShareVerdict}
                  className="px-3 py-1.5 text-xs rounded-full bg-judge/20 border border-judge/30 text-judge hover:bg-judge/30 transition-colors"
                >
                  {copiedVerdict ? "Copied!" : "Share Verdict"}
                </button>
              )}
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

          {/* TL;DR Card */}
          {isComplete && verdict && (
            <div className="mb-8 p-6 rounded-xl bg-judge-dim/20 border border-judge/20">
              <div className="text-xs font-semibold text-judge uppercase tracking-wider mb-2">
                Verdict
              </div>
              <p className="text-base font-medium text-zinc-100 leading-relaxed">
                {verdict}
              </p>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleShareVerdict}
                  className="px-4 py-2 text-xs font-medium rounded-full bg-judge/20 border border-judge/30 text-judge hover:bg-judge/30 transition-colors"
                >
                  {copiedVerdict ? "Copied!" : "Share This Verdict"}
                </button>
                <span className="text-xs text-zinc-600">Read the full debate below</span>
              </div>
            </div>
          )}

          {/* Collapsible original inputs */}
          {inputA && inputB && !waitingForSideB && (
            <div className="mb-6">
              <button
                onClick={() => setShowInputs(!showInputs)}
                className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <span className={`transition-transform ${showInputs ? "rotate-90" : ""}`}>
                  &#9654;
                </span>
                Original inputs from both sides
              </button>
              {showInputs && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-surface border border-side-a/10 p-4">
                    <div className="text-xs font-semibold text-side-a uppercase tracking-wider mb-2">
                      Side A&apos;s Input
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-[20]">
                      {inputA}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface border border-side-b/10 p-4">
                    <div className="text-xs font-semibold text-side-b uppercase tracking-wider mb-2">
                      Side B&apos;s Input
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-[20]">
                      {inputB}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Debate phases */}
          {DEBATE_PHASES.map((phase) => {
            const phaseData = phases.get(phase);
            if (!phaseData && currentPhase !== phase) return null;

            return (
              <PhaseSection
                key={phase}
                phase={phase}
                turns={phaseData?.turns.map((t) => ({ ...t, isStreaming: false })) || []}
                isActive={currentPhase === phase}
              />
            );
          })}

          {/* Waiting for Side B */}
          {waitingForSideB && (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mb-4" />
              <p className="text-sm mb-2">Waiting for the other side to submit...</p>
              <p className="text-xs text-zinc-600">This page will update automatically.</p>
            </div>
          )}

          {/* Analyzing state */}
          {!waitingForSideB && (currentPhase === "waiting") && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mb-4" />
              <p className="text-sm">Analyzing both sides...</p>
            </div>
          )}

          {/* Complete */}
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

function extractVerdict(content: string): string | null {
  const match = content.match(/\*\*Verdict:?\*\*\s*([\s\S]+)/);
  if (match) {
    return match[1].trim().replace(/\*\*/g, "");
  }
  return null;
}
