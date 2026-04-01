import { NextResponse } from "next/server";
import { getDebate } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const debate = await getDebate(id);

  if (!debate) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  return NextResponse.json(debate);
}
