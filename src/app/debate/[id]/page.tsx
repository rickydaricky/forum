import { DebateViewer } from "@/components/debate/debate-viewer";
import { getDebate } from "@/lib/db";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

function extractVerdict(rulingContent: string): string | null {
  const match = rulingContent.match(/\*\*Verdict:?\*\*\s*([\s\S]+)/);
  if (match) return match[1].trim().replace(/\*\*/g, "");
  return null;
}

const FALLBACK_METADATA: Metadata = {
  title: "Debate — Both Takes",
  description: "Watch AI advocates debate two sides of a disagreement.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  let debate;
  try {
    debate = await getDebate(id);
  } catch {
    return FALLBACK_METADATA;
  }

  if (!debate) {
    return { title: "Debate Not Found — Both Takes" };
  }

  const rulingPhase = debate.phases.find(
    (p) => p.phase === "ruling" && p.status === "complete"
  );
  const verdict = rulingPhase?.turns[0]?.content
    ? extractVerdict(rulingPhase.turns[0].content)
    : null;

  // Build a title from positions if available, otherwise fall back to generic
  const title = debate.position_a
    ? `"${debate.position_a.slice(0, 60)}${debate.position_a.length > 60 ? "…" : ""}" — Both Takes`
    : `Debate — Both Takes`;

  const description = verdict
    ? `Verdict: ${verdict}`
    : debate.status === "completed"
      ? "Two AI advocates debated. The judge has ruled."
      : "Two AI advocates are debating this live. Watch the ruling unfold.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Both Takes",
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function DebatePage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="flex flex-col h-screen">
      <DebateViewer debateId={id} />
    </div>
  );
}
