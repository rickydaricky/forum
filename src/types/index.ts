export type InputType = "claude-url" | "chatgpt-url" | "raw-text";

export type DebatePhase =
  | "extraction"
  | "opening"
  | "response"
  | "ruling";

export type Speaker = "advocate_a" | "advocate_b" | "judge";

export type DebateStatus =
  | "waiting_for_side_b"
  | "pending"
  | "extracting"
  | "in_progress"
  | "completed"
  | "error";

export type DebateMode = "both_sides" | "invite";

export interface ScrapedConversation {
  source: "claude" | "chatgpt" | "raw";
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  title?: string;
  rawText: string;
}

export interface PhaseTurn {
  speaker: Speaker;
  content: string;
}

export interface PhaseRecord {
  phase: DebatePhase;
  status: "pending" | "streaming" | "complete";
  turns: PhaseTurn[];
}

export interface Debate {
  id: string;
  created_at: string;
  status: DebateStatus;
  mode: DebateMode;
  invite_token: string | null;
  input_a_type: InputType | null;
  input_a_raw: string;
  input_b_type: InputType | null;
  input_b_raw: string;
  position_a: string | null;
  position_b: string | null;
  phases: PhaseRecord[];
  error_message: string | null;
  total_tokens_used: number;
}

// SSE event types
export type DebateEvent =
  | { type: "phase_start"; phase: DebatePhase }
  | {
      type: "extraction_complete";
      positionA: string;
      positionB: string;
    }
  | { type: "text_delta"; speaker: Speaker; content: string }
  | { type: "turn_complete"; speaker: Speaker }
  | { type: "phase_complete"; phase: DebatePhase }
  | { type: "debate_complete" }
  | { type: "error"; message: string };
