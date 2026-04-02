import { getDebate } from "@/lib/db";

export const maxDuration = 300;

const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/debate/[id]/stream
 *
 * Read-only SSE endpoint. Polls the database and streams debate progress.
 * Does NOT generate any content — that's done by the pipeline (via after()).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const debate = await getDebate(id);
  if (!debate) {
    return new Response("Debate not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let eventId = 0;
  const abortSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      function send(type: string, data: Record<string, unknown> = {}) {
        if (closed) return;
        eventId++;
        try {
          controller.enqueue(
            encoder.encode(`id: ${eventId}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
          );
        } catch (err) {
          console.warn(`Stream write failed for debate ${id}:`, err);
          closed = true;
        }
      }

      function sendKeepalive() {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closed = true;
        }
      }

      // Listen for client disconnect
      abortSignal.addEventListener("abort", () => {
        closed = true;
      });

      const keepalive = setInterval(sendKeepalive, 10000);
      const pollStart = Date.now();

      try {
        let sentPhaseCount = 0;
        const sentTurnCounts: Record<string, number> = {};
        const sentPhaseComplete: Record<string, boolean> = {};
        let sentStatus = "";

        while (!closed) {
          // Timeout — don't poll forever
          if (Date.now() - pollStart > MAX_POLL_DURATION_MS) {
            send("error", { message: "Debate is taking longer than expected. Please refresh the page." });
            break;
          }

          const current = await getDebate(id);
          if (!current) {
            send("error", { message: "Debate not found" });
            break;
          }

          // Status changes
          if (current.status !== sentStatus) {
            if (current.status === "waiting_for_side_b") {
              send("waiting_for_side_b");
            }
            if (current.status === "error") {
              send("error", { message: current.error_message || "Debate failed" });
              break;
            }
            sentStatus = current.status;
          }

          // Stream new phases and turns
          const visiblePhases = current.phases.filter((p) => p.phase !== "extraction");

          for (let i = 0; i < visiblePhases.length; i++) {
            const phase = visiblePhases[i];
            const phaseKey = phase.phase;
            const prevTurnCount = sentTurnCounts[phaseKey] || 0;

            // New phase appeared
            if (i >= sentPhaseCount) {
              send("phase_start", { phase: phaseKey });
              sentPhaseCount = i + 1;
              sentTurnCounts[phaseKey] = 0;
            }

            // New turns in this phase
            for (let t = prevTurnCount; t < phase.turns.length; t++) {
              const turn = phase.turns[t];
              send("turn", {
                speaker: turn.speaker,
                content: turn.content,
                phase: phaseKey,
              });
              sentTurnCounts[phaseKey] = t + 1;
            }

            // Phase completed (tracked separately to avoid the diff gap)
            if (phase.status === "complete" && !sentPhaseComplete[phaseKey]) {
              send("phase_complete", { phase: phaseKey });
              sentPhaseComplete[phaseKey] = true;
            }
          }

          // Debate complete
          if (current.status === "completed") {
            send("debate_complete", {
              inputA: current.input_a_raw,
              inputB: current.input_b_raw,
            });
            break;
          }

          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err) {
        console.error(`Stream observer error for debate ${id}:`, err);
        send("error", {
          message: err instanceof Error ? err.message : "Stream error",
        });
      } finally {
        clearInterval(keepalive);
        if (!closed) {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
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
