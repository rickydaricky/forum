import { NextResponse } from "next/server";
import { getDebate, joinDebate } from "@/lib/db";
import { scrapeInput } from "@/lib/scraper";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { input, inviteToken } = await request.json();

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

    const debate = await getDebate(id);
    if (!debate || debate.invite_token !== inviteToken) {
      return NextResponse.json(
        { error: "Invalid invite link" },
        { status: 403 }
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

    // Determine which side is missing and do an atomic update
    const isMissingSideB = !debate.input_b_raw;
    const updates = isMissingSideB
      ? { input_b_type: result.type, input_b_raw: result.conversation.rawText }
      : { input_a_type: result.type, input_a_raw: result.conversation.rawText };

    const joined = await joinDebate(id, inviteToken, updates);
    if (!joined) {
      return NextResponse.json(
        { error: "This debate has already started" },
        { status: 409 }
      );
    }

    return NextResponse.json({ debateId: id });
  } catch (err) {
    console.error("Failed to join debate:", err);
    return NextResponse.json(
      { error: "Failed to join debate. Please try again." },
      { status: 500 }
    );
  }
}
