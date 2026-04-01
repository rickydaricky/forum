import type { InputType, ScrapedConversation } from "@/types";
import { parseClaudeShare } from "./claude-share";
import { parseChatGPTShare } from "./chatgpt-share";
import { parseRawText } from "./raw-text";

export function detectInputType(input: string): InputType {
  const trimmed = input.trim();

  if (/^https?:\/\/(www\.)?claude\.ai\/share\//.test(trimmed)) {
    return "claude-url";
  }
  if (
    /^https?:\/\/(www\.)?(chat\.openai\.com|chatgpt\.com)\/share\//.test(
      trimmed
    )
  ) {
    return "chatgpt-url";
  }
  return "raw-text";
}

export async function scrapeInput(input: string): Promise<{
  type: InputType;
  conversation: ScrapedConversation;
}> {
  const type = detectInputType(input);

  switch (type) {
    case "claude-url":
      return {
        type,
        conversation: await parseClaudeShare(input.trim()),
      };
    case "chatgpt-url":
      return {
        type,
        conversation: await parseChatGPTShare(input.trim()),
      };
    case "raw-text":
      return {
        type,
        conversation: parseRawText(input),
      };
  }
}
