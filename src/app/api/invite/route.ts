import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { scrapeInput } from "@/lib/scraper";
import { createDebate } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { input, side } = await request.json();

    if (side !== "a" && side !== "b") {
      return NextResponse.json(
        { error: "side must be 'a' or 'b'" },
        { status: 400 }
      );
    }

    if (!input?.trim()) {
      return NextResponse.json(
        { error: "Your side is required" },
        { status: 400 }
      );
    }

    if (input.trim().length < 20) {
      return NextResponse.json(
        { error: "Needs at least 20 characters to work with" },
        { status: 400 }
      );
    }

    if (input.trim().length > 50000) {
      return NextResponse.json(
        { error: "Input too long (max 50,000 characters)" },
        { status: 400 }
      );
    }

    let result;
    try {
      result = await scrapeInput(input);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse input";
      return NextResponse.json(
        { error: `Failed to parse input: ${message}. Try pasting the conversation text directly.` },
        { status: 422 }
      );
    }

    const id = nanoid(10);
    const inviteToken = nanoid(16);

    await createDebate({
      id,
      mode: "invite",
      invite_token: inviteToken,
      ...(side === "a"
        ? {
            input_a_type: result.type,
            input_a_raw: result.conversation.rawText,
          }
        : {
            input_b_type: result.type,
            input_b_raw: result.conversation.rawText,
          }),
    });

    return NextResponse.json({
      debateId: id,
      inviteToken,
    });
  } catch (err) {
    console.error("Failed to create invite:", err);
    return NextResponse.json(
      { error: "Failed to create invite. Please try again." },
      { status: 500 }
    );
  }
}
