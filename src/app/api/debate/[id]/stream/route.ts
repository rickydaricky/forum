import { getDebate, updateDebate, appendPhase, updateLatestPhase, claimExtraction } from "@/lib/db";
import { runExtraction, runDebatePhase } from "@/lib/debate/orchestrator";
import type { DebateEvent, DebatePhase, PhaseRecord, Speaker } from "@/types";

export const maxDuration = 60; // Vercel function timeout (seconds)

const VALID_DEBATE_PHASES = new Set<DebatePhase>([
  "opening",
  "response",
  "ruling",
]);

function isDebatePhase(s: string): s is DebatePhase {
  return s === "extraction" || VALID_DEBATE_PHASES.has(s as DebatePhase);
}

/** Accumulates text_delta events into complete turns */
function createTurnAccumulator(phaseRecord: PhaseRecord) {
  let currentSpeaker: Speaker | null = null;
  let currentContent = "";

  return {
    onEvent(event: DebateEvent) {
      if (event.type === "text_delta") {
        if (currentSpeaker !== event.speaker) {
          this.flush();
          currentSpeaker = event.speaker;
          currentContent = "";
        }
        currentContent += event.content;
      }
      if (event.type === "turn_complete") {
        this.flush();
      }
    },
    flush() {
      if (currentSpeaker && currentContent) {
        phaseRecord.turns.push({
          speaker: currentSpeaker,
          content: currentContent,
        });
      }
      currentSpeaker = null;
      currentContent = "";
    },
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const phase = url.searchParams.get("phase");

  if (!phase) {
    return new Response("Missing phase parameter", { status: 400 });
  }

  if (!isDebatePhase(phase)) {
    return new Response(`Invalid phase: ${phase}`, { status: 400 });
  }

  const debate = await getDebate(id);
  if (!debate) {
    return new Response("Debate not found", { status: 404 });
  }

  // Prevent duplicate phase execution
  const existingPhase = debate.phases.find((p) => p.phase === phase);
  if (existingPhase && existingPhase.status === "complete") {
    return new Response("Phase already completed", { status: 200 });
  }
  if (phase !== "extraction" && existingPhase?.status === "streaming") {
    return new Response("Phase already in progress", { status: 200 });
  }

  // For extraction: atomically claim it so only one client runs it
  if (phase === "extraction") {
    const claimed = await claimExtraction(id);
    if (!claimed) {
      return new Response("Extraction already started", { status: 200 });
    }
  }

  const encoder = new TextEncoder();
  let eventId = 0;

  // Send SSE keepalive comments every 10s to prevent connection timeout
  let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let clientDisconnected = false;

      function send(event: DebateEvent) {
        if (clientDisconnected) return;
        eventId++;
        const data = `id: ${eventId}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          clientDisconnected = true;
          console.warn(`Client disconnected during debate ${id}, phase ${phase}`);
        }
      }

      function sendKeepalive() {
        if (clientDisconnected) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clientDisconnected = true;
          if (keepaliveInterval) clearInterval(keepaliveInterval);
        }
      }

      keepaliveInterval = setInterval(sendKeepalive, 10000);

      try {
        if (phase === "extraction") {
          // Status already set to "extracting" by claimExtraction()
          const gen = runExtraction(
            debate.input_a_raw,
            debate.input_b_raw
          );

          const phaseRecord: PhaseRecord = {
            phase: "extraction",
            status: "streaming",
            turns: [],
          };
          await appendPhase(id, phaseRecord);

          const accumulator = createTurnAccumulator(phaseRecord);
          let positionA = "";
          let positionB = "";
          let stakes = "medium";

          while (true) {
            if (clientDisconnected) break;
            const { value, done } = await gen.next();
            if (done) {
              const result = value as {
                positionA: string;
                positionB: string;
                stakes: string;
              };
              positionA = result.positionA;
              positionB = result.positionB;
              stakes = result.stakes;
              break;
            }
            send(value);
            accumulator.onEvent(value);
          }

          phaseRecord.status = "complete";
          await updateLatestPhase(id, phaseRecord);
          await updateDebate(id, {
            status: "in_progress",
            position_a: positionA,
            position_b: positionB,
            stakes,
          });
        } else {
          if (!debate.position_a || !debate.position_b) {
            send({
              type: "error",
              message: "Extraction must complete before debate phases",
            });
            controller.close();
            return;
          }

          const transcript = buildTranscript(debate.phases);

          // phase is validated as DebatePhase by isDebatePhase() above
          const gen = runDebatePhase(
            phase,
            debate.position_a,
            debate.position_b,
            transcript,
            debate.stakes || "medium"
          );

          const phaseRecord: PhaseRecord = {
            phase,
            status: "streaming",
            turns: [],
          };
          await appendPhase(id, phaseRecord);

          const accumulator = createTurnAccumulator(phaseRecord);

          for await (const event of gen) {
            if (clientDisconnected) break;
            send(event);
            accumulator.onEvent(event);
          }

          phaseRecord.status = "complete";
          await updateLatestPhase(id, phaseRecord);

          if (phase === "ruling") {
            await updateDebate(id, { status: "completed" });
          }
        }
      } catch (err) {
        console.error(`Stream error for debate ${id}, phase ${phase}:`, err);
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "An unexpected error occurred",
        });
        try {
          await updateDebate(id, {
            status: "error",
            error_message:
              err instanceof Error ? err.message : "Unknown error",
          });
        } catch (dbErr) {
          console.error(`Failed to persist error state for debate ${id}:`, dbErr);
        }
      } finally {
        if (keepaliveInterval) clearInterval(keepaliveInterval);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function buildTranscript(phases: PhaseRecord[]): string {
  const parts: string[] = [];

  for (const phase of phases) {
    for (const turn of phase.turns) {
      const label =
        turn.speaker === "advocate_a"
          ? "ADVOCATE A"
          : turn.speaker === "advocate_b"
            ? "ADVOCATE B"
            : "JUDGE";
      parts.push(`${label}:\n${turn.content}`);
    }
  }

  return parts.join("\n\n");
}
