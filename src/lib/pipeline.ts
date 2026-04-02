import "server-only";
import { getDebate, updateDebate, appendPhase, updateLatestPhase, claimExtraction } from "@/lib/db";
import { runExtraction, runDebatePhase } from "@/lib/debate/orchestrator";
import type { DebateEvent, DebatePhase, PhaseRecord, Speaker } from "@/types";

const DEBATE_PHASES: DebatePhase[] = ["opening", "response", "ruling"];

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

/**
 * Attempt to claim and run the full debate pipeline.
 * Returns false if another instance already claimed it.
 * Safe to call from after() — runs to completion.
 */
export async function triggerPipeline(debateId: string): Promise<boolean> {
  const debate = await getDebate(debateId);
  if (!debate) return false;

  const claimed = await claimExtraction(debateId);
  if (!claimed) return false;

  await runPipeline(debateId, debate.input_a_raw, debate.input_b_raw);
  return true;
}

async function runPipeline(id: string, inputA: string, inputB: string) {
  try {
    // Phase 1: Extraction
    const extractionRecord: PhaseRecord = {
      phase: "extraction",
      status: "streaming",
      turns: [],
    };
    await appendPhase(id, extractionRecord);

    const accumulator = createTurnAccumulator(extractionRecord);
    const extractionGen = runExtraction(inputA, inputB);
    let positionA = "";
    let positionB = "";
    let stakes = "medium";

    while (true) {
      const { value, done } = await extractionGen.next();
      if (done) {
        const result = value as { positionA: string; positionB: string; stakes: string };
        positionA = result.positionA;
        positionB = result.positionB;
        stakes = result.stakes;
        break;
      }
      accumulator.onEvent(value);
    }

    extractionRecord.status = "complete";
    await updateLatestPhase(id, extractionRecord);
    await updateDebate(id, {
      status: "in_progress",
      position_a: positionA,
      position_b: positionB,
      stakes,
    });

    // Phases 2-4: Opening, Response, Ruling
    for (const phase of DEBATE_PHASES) {
      const currentDebate = await getDebate(id);
      if (!currentDebate) throw new Error("Debate disappeared");

      const transcript = buildTranscript(currentDebate.phases);

      const phaseRecord: PhaseRecord = {
        phase,
        status: "streaming",
        turns: [],
      };
      await appendPhase(id, phaseRecord);

      const phaseAccumulator = createTurnAccumulator(phaseRecord);
      const gen = runDebatePhase(phase, positionA, positionB, transcript, stakes);

      for await (const event of gen) {
        phaseAccumulator.onEvent(event);
      }

      phaseRecord.status = "complete";
      await updateLatestPhase(id, phaseRecord);

      if (phase === "ruling") {
        await updateDebate(id, { status: "completed" });
      }
    }
  } catch (err) {
    console.error(`Pipeline error for debate ${id}:`, err);
    try {
      await updateDebate(id, {
        status: "error",
        error_message: "Something went wrong while generating the debate. Please try creating a new one.",
      });
    } catch (dbErr) {
      console.error(`CRITICAL: Failed to persist error state for debate ${id}:`, dbErr);
    }
  }
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
