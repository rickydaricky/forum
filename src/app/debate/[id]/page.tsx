import { DebateViewer } from "@/components/debate/debate-viewer";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Debate ${id} — The Forum`,
    description: "Watch AI advocates debate two sides of a disagreement.",
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
