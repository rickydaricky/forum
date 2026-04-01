import * as cheerio from "cheerio";
import type { ScrapedConversation } from "@/types";

export async function parseChatGPTShare(
  url: string
): Promise<ScrapedConversation> {
  const parsed = new URL(url);
  const validHosts = ["chatgpt.com", "www.chatgpt.com", "chat.openai.com", "www.chat.openai.com"];
  if (!validHosts.includes(parsed.hostname)) {
    throw new Error("Invalid ChatGPT share URL hostname");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const messages: ScrapedConversation["messages"] = [];

    // ChatGPT share pages use data-message-author-role attributes
    $("[data-message-author-role]").each((_, el) => {
      const role = $(el).attr("data-message-author-role");
      const content = $(el).text().trim();
      if (content && (role === "user" || role === "assistant")) {
        messages.push({ role, content });
      }
    });

    // Fallback: try to find conversation structure in script tags
    if (messages.length === 0) {
      $("script").each((_, el) => {
        const scriptContent = $(el).html() || "";
        if (
          scriptContent.includes('"message"') &&
          scriptContent.includes('"author"')
        ) {
          try {
            // Look for JSON-like structures in script content
            const jsonMatch = scriptContent.match(
              /\{[\s\S]*"mapping"[\s\S]*\}/
            );
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[0]);
              extractFromMapping(data.mapping, messages);
            }
          } catch (err) {
            console.warn("ChatGPT share: script JSON parsing failed:", err);
          }
        }
      });
    }

    // Final fallback: grab all text
    if (messages.length === 0) {
      const allText = $("body").text().trim();
      if (allText.length > 100) {
        return {
          source: "chatgpt",
          messages: [],
          rawText: allText.slice(0, 16000),
        };
      }
      throw new Error(
        "Could not extract conversation from ChatGPT share link"
      );
    }

    return {
      source: "chatgpt",
      messages,
      title: $("title").text() || "ChatGPT Conversation",
      rawText: messages.map((m) => `${m.role}: ${m.content}`).join("\n\n"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractFromMapping(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapping: Record<string, any>,
  messages: ScrapedConversation["messages"]
): void {
  if (!mapping) return;

  // ChatGPT stores messages in a tree structure via "mapping"
  const nodes = Object.values(mapping).filter(
    (n) => n?.message?.content?.parts
  );

  // Sort by creation time if available
  nodes.sort(
    (a, b) =>
      (a.message?.create_time || 0) - (b.message?.create_time || 0)
  );

  for (const node of nodes) {
    const msg = node.message;
    if (!msg) continue;

    const role = msg.author?.role;
    if (role !== "user" && role !== "assistant") continue;

    const content = msg.content?.parts
      ?.filter((p: unknown) => typeof p === "string")
      .join("");

    if (content?.trim()) {
      messages.push({ role, content: content.trim() });
    }
  }
}
