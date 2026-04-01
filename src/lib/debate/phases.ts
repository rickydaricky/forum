import type { DebatePhase } from "@/types";

export const PHASE_ORDER: DebatePhase[] = [
  "extraction",
  "opening",
  "response",
  "ruling",
];

export const PHASE_LABELS: Record<DebatePhase, string> = {
  extraction: "Analyzing Positions",
  opening: "Opening Statements",
  response: "Responses",
  ruling: "Judge's Ruling",
};
