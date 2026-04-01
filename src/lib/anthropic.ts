import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing required environment variable: ANTHROPIC_API_KEY"
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const MODEL = "claude-sonnet-4-20250514";
