import { getAnthropicClient, MODEL } from "@/lib/anthropic";
import {
  EXTRACTION_SYSTEM,
  getAdvocateSystem,
  getResponseSystem,
  getJudgeSystem,
} from "./prompts";
import type { DebateEvent, DebatePhase, Speaker } from "@/types";

/**
 * Stream text from Claude, yielding DebateEvents for each chunk.
 * Returns the full accumulated text.
 */
async function* streamClaude(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  speaker: Speaker,
  maxTokens: number = 1024
): AsyncGenerator<DebateEvent, string> {
  const client = getAnthropicClient();
  let fullText = "";

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
      yield { type: "text_delta", speaker, content: event.delta.text };
    }
  }

  yield { type: "turn_complete", speaker };
  return fullText;
}

async function* extractPosition(
  conversationText: string,
  speaker: Speaker
): AsyncGenerator<DebateEvent, string> {
  return yield* streamClaude(
    EXTRACTION_SYSTEM,
    [
      {
        role: "user",
        content: `Here is the conversation or text representing one side of a disagreement. Extract their position:\n\n${conversationText.slice(0, 16000)}`,
      },
    ],
    speaker,
    1024
  );
}

/** Parse the STAKES line from extraction output. Returns "low", "medium", or "high". */
function parseStakes(extractionA: string, extractionB: string): string {
  const combined = extractionA + "\n" + extractionB;
  const match = combined.match(/\*\*STAKES\*\*:\s*(LOW|MEDIUM|HIGH)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return "medium";
}

/** Parse RELATIONSHIP terms from extraction outputs, return a pronoun guide string. */
function buildPronounGuide(extractionA: string, extractionB: string): string {
  const matchA = extractionA.match(/\*\*RELATIONSHIP\*\*:\s*(.+)/i);
  const matchB = extractionB.match(/\*\*RELATIONSHIP\*\*:\s*(.+)/i);
  const relA = matchA?.[1]?.trim().toLowerCase() ?? "";
  const relB = matchB?.[1]?.trim().toLowerCase() ?? "";

  // Detect if both sides use the same gendered term
  const maleTerms = ["boyfriend", "husband", "brother", "father", "son", "dad"];
  const femaleTerms = ["girlfriend", "wife", "sister", "mother", "daughter", "mom"];

  const aIsMale = maleTerms.some((t) => relA.includes(t));
  const bIsMale = maleTerms.some((t) => relB.includes(t));
  const aIsFemale = femaleTerms.some((t) => relA.includes(t));
  const bIsFemale = femaleTerms.some((t) => relB.includes(t));

  const parts: string[] = [];
  if (relA) parts.push(`Side A describes the other person as "${matchA![1].trim()}".`);
  if (relB) parts.push(`Side B describes the other person as "${matchB![1].trim()}".`);

  if (aIsMale && bIsMale) {
    parts.push("Both people are male. Use he/him for both. Do NOT use she/her/girlfriend/woman.");
  } else if (aIsFemale && bIsFemale) {
    parts.push("Both people are female. Use she/her for both. Do NOT use he/him/boyfriend/man.");
  }

  return parts.length > 0 ? parts.join(" ") : "";
}

async function* openingStatement(
  side: "A" | "B",
  position: string,
  opposingPosition: string,
  stakes: string,
  pronounGuide: string
): AsyncGenerator<DebateEvent, string> {
  const speaker: Speaker = side === "A" ? "advocate_a" : "advocate_b";
  const system = getAdvocateSystem(side, position, stakes, pronounGuide);

  return yield* streamClaude(
    system,
    [
      {
        role: "user",
        content: `The opposing side's position is:\n\n${opposingPosition}\n\nDeliver your opening statement.`,
      },
    ],
    speaker,
    512
  );
}

async function* responseTurn(
  side: "A" | "B",
  position: string,
  openingA: string,
  openingB: string,
  stakes: string,
  pronounGuide: string
): AsyncGenerator<DebateEvent, string> {
  const speaker: Speaker = side === "A" ? "advocate_a" : "advocate_b";
  const system = getResponseSystem(side, position, stakes, pronounGuide);
  const opposingOpening = side === "A" ? openingB : openingA;

  return yield* streamClaude(
    system,
    [
      {
        role: "user",
        content: `The opposing advocate's opening statement was:\n\n${opposingOpening}\n\nDeliver your response.`,
      },
    ],
    speaker,
    600
  );
}

/**
 * Run a single debate phase. Each phase is a separate generator call
 * to stay within Vercel function timeout limits.
 */
export async function* runDebatePhase(
  phase: DebatePhase,
  positionA: string,
  positionB: string,
  existingTranscript: string,
  stakes: string = "medium",
  pronounGuide: string = ""
): AsyncGenerator<DebateEvent> {
  switch (phase) {
    case "opening": {
      yield { type: "phase_start", phase: "opening" };

      const openingA = yield* openingStatement("A", positionA, positionB, stakes, pronounGuide);
      const openingB = yield* openingStatement("B", positionB, positionA, stakes, pronounGuide);

      void openingA;
      void openingB;

      yield { type: "phase_complete", phase: "opening" };
      break;
    }

    case "response": {
      yield { type: "phase_start", phase: "response" };

      const parts = existingTranscript.split("\n\n");
      let openingA = "";
      let openingB = "";
      for (const part of parts) {
        if (part.startsWith("ADVOCATE A:")) {
          openingA = part.replace("ADVOCATE A:", "").trim();
        }
        if (part.startsWith("ADVOCATE B:")) {
          openingB = part.replace("ADVOCATE B:", "").trim();
        }
      }

      yield* responseTurn("A", positionA, openingA, openingB, stakes, pronounGuide);
      yield* responseTurn("B", positionB, openingA, openingB, stakes, pronounGuide);

      yield { type: "phase_complete", phase: "response" };
      break;
    }

    case "ruling": {
      yield { type: "phase_start", phase: "ruling" };

      const judgeSystem = getJudgeSystem(positionA, positionB, stakes, pronounGuide);
      yield* streamClaude(
        judgeSystem,
        [
          {
            role: "user",
            content: `Here is the complete debate transcript:\n\n${existingTranscript}\n\nDeliver your ruling.`,
          },
        ],
        "judge",
        1024
      );

      yield { type: "phase_complete", phase: "ruling" };
      yield { type: "debate_complete" };
      break;
    }

    case "extraction": {
      throw new Error("Use runExtraction() for the extraction phase");
    }

    default: {
      const _exhaustive: never = phase;
      throw new Error(`Unknown debate phase: ${_exhaustive}`);
    }
  }
}

/**
 * Run the extraction phase. Returns extracted positions and stakes.
 */
export async function* runExtraction(
  inputA: string,
  inputB: string
): AsyncGenerator<DebateEvent, { positionA: string; positionB: string; stakes: string; pronounGuide: string }> {
  yield { type: "phase_start", phase: "extraction" };

  const positionA = yield* extractPosition(inputA, "advocate_a");
  const positionB = yield* extractPosition(inputB, "advocate_b");

  const stakes = parseStakes(positionA, positionB);
  const pronounGuide = buildPronounGuide(positionA, positionB);

  yield {
    type: "extraction_complete",
    positionA,
    positionB,
    stakes,
  };
  yield { type: "phase_complete", phase: "extraction" };

  return { positionA, positionB, stakes, pronounGuide };
}
