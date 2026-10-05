import { removePiDocs } from "./pi-docs.ts";
import { isRecord } from "./util.ts";

const IDENTITY_TEXT =
  "You are Claude Code, Anthropic's official CLI for Claude.";
const BILLING_PREFIX = "x-anthropic-billing-header:";

function isTextBlock(
  value: unknown,
): value is Record<string, unknown> & { text: string } {
  return (
    isRecord(value) && value.type === "text" && typeof value.text === "string"
  );
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(isTextBlock)
    .map((block) => block.text)
    .join("\n");
}

export function firstUserText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) return "";
  const first = payload.messages.find(
    (message) => isRecord(message) && message.role === "user",
  );
  return isRecord(first) ? textOf(first.content) : "";
}

/**
 * Puts the billing block first, drops any earlier billing block and Pi's
 * Claude Code identity line, and removes Pi's documentation section.
 */
export function rewriteSystem(payload: unknown, billing: string): unknown {
  if (!isRecord(payload)) return payload;
  const blocks =
    typeof payload.system === "string"
      ? [{ type: "text", text: payload.system }]
      : Array.isArray(payload.system)
        ? payload.system
        : [];
  const prompt = blocks.flatMap((block): unknown[] => {
    if (!isTextBlock(block)) return [block];
    if (block.text.startsWith(BILLING_PREFIX)) return [];
    const text = removePiDocs(block.text);
    return text ? [{ ...block, text }] : [];
  });
  const withoutIdentity = prompt.filter(
    (block) => !isTextBlock(block) || block.text !== IDENTITY_TEXT,
  );
  // Keep the identity line when it is the whole prompt.
  const kept = withoutIdentity.some(isTextBlock) ? withoutIdentity : prompt;
  return { ...payload, system: [{ type: "text", text: billing }, ...kept] };
}
