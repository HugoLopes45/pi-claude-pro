import {
  getCurrentSystemMessage,
  normalizeContext,
  type Message,
  type SystemMessage,
  type TranscriptContext,
} from "@earendil-works/pi-ai";

// Forced prompts lose their section names. Recognize Pi's heading, not every
// <docs> block, and never consume a second block after an unclosed one.
const PI_DOCS = /<docs>\s*Pi documentation\b(?:(?!<\/?docs>)[\s\S])*<\/docs>/g;

function removePiDocs(text: string): string {
  return text.replace(PI_DOCS, "");
}

function withoutPiDocs(message: SystemMessage): SystemMessage {
  const content =
    typeof message.content === "string"
      ? removePiDocs(message.content)
      : message.content.flatMap((block) => {
          const text = removePiDocs(block.text);
          return text === block.text
            ? [block]
            : text
              ? [{ ...block, text }]
              : [];
        });
  const sections = message.sections && { ...message.sections };
  if (sections && typeof sections.docs === "string") {
    const text = removePiDocs(sections.docs);
    if (text !== sections.docs) {
      if (text.trim()) sections.docs = text;
      else delete sections.docs;
    }
  }
  return { ...message, content, ...(sections ? { sections } : {}) };
}

export function movePiDocs(context: TranscriptContext): TranscriptContext {
  const firstUser = context.messages.findIndex(
    (message) => message.role === "user",
  );
  if (firstUser < 0) return context;
  const system = getCurrentSystemMessage(context.messages);
  if (!system) return context;
  // Detect in the same text boundaries used for removal. Joining blocks here
  // could recognize docs that cannot be removed without losing block metadata.
  const texts = context.messages.flatMap((message) => {
    if (message.role !== "system") return [];
    return typeof message.content === "string"
      ? [message.content]
      : message.content.map((block) => block.text);
  });
  texts.push(system.sections?.docs ?? "");
  const docs = [
    ...new Set(
      texts.flatMap((text) =>
        [...text.matchAll(PI_DOCS)].map((match) => match[0]),
      ),
    ),
  ];
  if (docs.length === 0) return context;

  const messages = context.messages.map((message, index): Message => {
    if (message.role === "system") return withoutPiDocs(message);
    if (message.role !== "user" || index !== firstUser) return message;
    const content =
      typeof message.content === "string"
        ? message.content
          ? [{ type: "text" as const, text: message.content }]
          : []
        : message.content;
    return {
      ...message,
      content: [
        ...docs.map((text) => ({ type: "text" as const, text })),
        ...content,
      ],
    };
  });
  return normalizeContext({ messages });
}
