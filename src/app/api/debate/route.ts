import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { scrapeInput } from "@/lib/scraper";
import { createDebate } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { inputA, inputB } = await request.json();

    if (!inputA?.trim() || !inputB?.trim()) {
      return NextResponse.json(
        { error: "Both sides are required" },
        { status: 400 }
      );
    }

    if (inputA.trim().length < 20 || inputB.trim().length < 20) {
      return NextResponse.json(
        { error: "Each side needs at least 20 characters to work with" },
        { status: 400 }
      );
    }

    if (inputA.trim().length > 50000 || inputB.trim().length > 50000) {
      return NextResponse.json(
        { error: "Input too long (max 50,000 characters per side)" },
        { status: 400 }
      );
    }

    // Scrape/parse both inputs
    let resultA, resultB;
    try {
      [resultA, resultB] = await Promise.all([
        scrapeInput(inputA),
        scrapeInput(inputB),
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse inputs";
      return NextResponse.json(
        {
          error: `Failed to parse input: ${message}. Try pasting the conversation text directly.`,
        },
        { status: 422 }
      );
    }

    const id = nanoid(10);

    const debate = await createDebate({
      id,
      input_a_type: resultA.type,
      input_a_raw: resultA.conversation.rawText,
      input_b_type: resultB.type,
      input_b_raw: resultB.conversation.rawText,
    });

    return NextResponse.json({
      id: debate.id,
      inputAType: resultA.type,
      inputBType: resultB.type,
    });
  } catch (err) {
    console.error("Failed to create debate:", err);
    return NextResponse.json(
      { error: "Failed to create debate. Please try again." },
      { status: 500 }
    );
  }
}
