import Markdown from "react-markdown";
import type { Speaker } from "@/types";

interface MessageBubbleProps {
  speaker: Speaker;
  content: string;
  isStreaming?: boolean;
}

const SPEAKER_CONFIG: Record<
  Speaker,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  advocate_a: {
    label: "Advocate A",
    color: "text-side-a",
    bgColor: "bg-side-a-dim/30",
    borderColor: "border-side-a/20",
  },
  advocate_b: {
    label: "Advocate B",
    color: "text-side-b",
    bgColor: "bg-side-b-dim/30",
    borderColor: "border-side-b/20",
  },
  judge: {
    label: "The Judge",
    color: "text-judge",
    bgColor: "bg-judge-dim/30",
    borderColor: "border-judge/20",
  },
};

export function MessageBubble({
  speaker,
  content,
  isStreaming,
}: MessageBubbleProps) {
  const config = SPEAKER_CONFIG[speaker];

  return (
    <div
      className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-5 ${
        speaker === "judge" ? "max-w-3xl mx-auto" : ""
      }`}
    >
      <div className={`text-xs font-semibold ${config.color} mb-3 uppercase tracking-wider`}>
        {config.label}
      </div>
      <div
        className={`text-sm leading-relaxed text-zinc-200 prose prose-sm prose-invert max-w-none ${
          isStreaming ? "streaming-cursor" : ""
        }`}
      >
        <Markdown>{content}</Markdown>
      </div>
    </div>
  );
}
