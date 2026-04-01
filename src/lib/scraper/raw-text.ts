import type { ScrapedConversation } from "@/types";

export function parseRawText(text: string): ScrapedConversation {
  return {
    source: "raw",
    messages: [],
    rawText: text.slice(0, 16000),
  };
}
