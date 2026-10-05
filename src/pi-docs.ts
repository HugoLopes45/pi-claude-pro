import {
  getCurrentSystemMessage,
  normalizeContext,
  type Message,
  type TranscriptContext,
} from "@earendil-works/pi-ai";

/** Name of the system prompt section where Pi lists its documentation. */
const DOCS_SECTION = "docs";

function hasDocs(message: Message): boolean {
  return message.role === "system" && DOCS_SECTION in (message.sections ?? {});
}

/**
 * Moves Pi's documentation section from the system prompt to the start of the
 * first user message. The model keeps the docs; the system prompt loses them.
 */
export function movePiDocs(context: TranscriptContext): TranscriptContext {
  if (!context.messages.some(hasDocs)) return context;
  const docs = getCurrentSystemMessage(context.messages)?.sections?.[
    DOCS_SECTION
  ];
  let firstUser = true;
  const messages = context.messages.map((message): Message => {
    if (message.role === "system" && hasDocs(message)) {
      const sections = Object.entries(message.sections ?? {}).filter(
        ([name]) => name !== DOCS_SECTION,
      );
      return { ...message, sections: Object.fromEntries(sections) };
    }
    if (message.role !== "user" || !firstUser || !docs) return message;
    firstUser = false;
    const content =
      typeof message.content === "string"
        ? message.content
          ? [{ type: "text" as const, text: message.content }]
          : []
        : message.content;
    return {
      ...message,
      content: [{ type: "text", text: docs }, ...content],
    };
  });
  return normalizeContext({ messages });
}
