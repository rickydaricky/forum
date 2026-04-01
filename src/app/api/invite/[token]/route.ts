import { NextResponse } from "next/server";
import { getDebateByInviteToken } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const debate = await getDebateByInviteToken(token);
    if (!debate) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      debateId: debate.id,
      status: debate.status,
    });
  } catch (err) {
    console.error("Failed to look up invite:", err);
    return NextResponse.json(
      { error: "Failed to look up invite. Please try again." },
      { status: 500 }
    );
  }
}
