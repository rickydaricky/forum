import * as cheerio from "cheerio";
import type { ScrapedConversation } from "@/types";

export async function parseClaudeShare(
  url: string
): Promise<ScrapedConversation> {
  const parsed = new URL(url);
  if (!["claude.ai", "www.claude.ai"].includes(parsed.hostname)) {
    throw new Error("Invalid Claude share URL hostname");
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

    // Try to extract from __NEXT_DATA__ script tag
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const messages = extractMessagesFromNextData(nextData);
        if (messages.length > 0) {
          return {
            source: "claude",
            messages,
            title:
              nextData?.props?.pageProps?.title || "Claude Conversation",
            rawText: messages
              .map((m) => `${m.role}: ${m.content}`)
              .join("\n\n"),
          };
        }
      } catch (err) {
        console.warn("Claude share: __NEXT_DATA__ parsing failed, falling back to DOM extraction:", err);
      }
    }

    // Fallback: extract from DOM elements
    const messages: ScrapedConversation["messages"] = [];
    $("[data-testid]").each((_, el) => {
      const testId = $(el).attr("data-testid") || "";
      if (testId.includes("human") || testId.includes("user")) {
        messages.push({ role: "user", content: $(el).text().trim() });
      } else if (testId.includes("assistant") || testId.includes("ai")) {
        messages.push({ role: "assistant", content: $(el).text().trim() });
      }
    });

    // Another fallback: look for conversation turn containers
    if (messages.length === 0) {
      const allText = $("body").text().trim();
      if (allText.length > 100) {
        return {
          source: "claude",
          messages: [],
          rawText: allText.slice(0, 16000),
        };
      }
    }

    if (messages.length === 0) {
      throw new Error(
        "Could not extract conversation from Claude share link"
      );
    }

    return {
      source: "claude",
      messages,
      rawText: messages.map((m) => `${m.role}: ${m.content}`).join("\n\n"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractMessagesFromNextData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): ScrapedConversation["messages"] {
  const messages: ScrapedConversation["messages"] = [];

  // Navigate through various possible paths in Next.js data
  const pageProps = data?.props?.pageProps;
  if (!pageProps) return messages;

  // Try common paths where conversation data might live
  const conversation =
    pageProps.conversation ||
    pageProps.chat ||
    pageProps.messages ||
    pageProps.data?.conversation;
  if (!conversation) return messages;

  const msgList = Array.isArray(conversation)
    ? conversation
    : conversation.messages || conversation.chat_messages || [];

  for (const msg of msgList) {
    const role =
      msg.role === "human" || msg.role === "user" || msg.sender === "human"
        ? "user"
        : "assistant";
    const content =
      typeof msg.content === "string"
        ? msg.content
        : msg.content?.text ||
          msg.text ||
          (Array.isArray(msg.content)
            ? msg.content.map((c: { text?: string }) => c.text || "").join("")
            : "");

    if (content.trim()) {
      messages.push({ role, content: content.trim() });
    }
  }

  return messages;
}
