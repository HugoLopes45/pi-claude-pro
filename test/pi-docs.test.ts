import {
  getCurrentSystemPrompt,
  normalizeContext,
  type Message,
} from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { movePiDocs } from "../src/pi-docs.ts";

const DOCS = "<docs>\nPi documentation\n</docs>";

function system(sections: Record<string, string | null>): Message {
  return { role: "system", content: "Prompt", sections, timestamp: 0 };
}

function user(content: string): Message {
  return { role: "user", content, timestamp: 0 };
}

describe("movePiDocs", () => {
  it("moves the docs section to the start of the first user message", () => {
    const context = normalizeContext({
      messages: [
        system({ docs: DOCS, cwd: "<cwd>\n/tmp\n</cwd>" }),
        user("Comment créer une extension pour cet agent ?"),
        user("later"),
      ],
    });
    expect(movePiDocs(context).messages).toEqual([
      system({ cwd: "<cwd>\n/tmp\n</cwd>" }),
      {
        role: "user",
        content: [
          { type: "text", text: DOCS },
          {
            type: "text",
            text: "Comment créer une extension pour cet agent ?",
          },
        ],
        timestamp: 0,
      },
      user("later"),
    ]);
  });

  it("keeps the other blocks of the first user message", () => {
    const image = { type: "image" as const, data: "x", mimeType: "image/png" };
    const context = normalizeContext({
      messages: [
        system({ docs: DOCS }),
        { role: "user", content: [image], timestamp: 0 },
      ],
    });
    expect(movePiDocs(context).messages[1]).toEqual({
      role: "user",
      content: [{ type: "text", text: DOCS }, image],
      timestamp: 0,
    });
  });

  it("uses the docs of the latest system message and strips every copy", () => {
    const context = normalizeContext({
      messages: [
        system({ docs: "<docs>\nPi documentation (old)\n</docs>" }),
        user("hi"),
        system({ docs: DOCS }),
      ],
    });
    expect(movePiDocs(context).messages).toEqual([
      system({}),
      {
        role: "user",
        content: [
          { type: "text", text: DOCS },
          { type: "text", text: "hi" },
        ],
        timestamp: 0,
      },
      system({}),
    ]);
  });

  it.each([DOCS, "<docs>\r\n  Pi documentation (SDK)\r\n</docs>"])(
    "moves Pi docs from a text prompt: %s",
    (docs) => {
      const custom = "<docs>Project documentation</docs>";
      const context = normalizeContext({
        systemPrompt: `Before\n${docs}\n${custom}\nAfter`,
        messages: [user("hello")],
      });
      const original = structuredClone(context.messages);
      const moved = movePiDocs(context);
      expect(getCurrentSystemPrompt(moved.messages)).toBe(
        `Before\n\n${custom}\nAfter`,
      );
      expect(moved.messages[1]).toEqual({
        ...user("hello"),
        content: [
          { type: "text", text: docs },
          { type: "text", text: "hello" },
        ],
      });
      expect(context.messages).toEqual(original);
      expect(movePiDocs(moved)).toEqual(moved);
    },
  );

  it("preserves text-block metadata and unrelated system sections", () => {
    const context = normalizeContext({
      messages: [
        {
          role: "system",
          timestamp: 0,
          content: [
            {
              type: "text",
              text: `Before${DOCS}After`,
              textSignature: "signature",
            },
          ],
          sections: { rules: "Keep these rules", skills: "Keep these skills" },
        },
        user("hello"),
      ],
    });
    const moved = movePiDocs(context);
    expect(moved.messages[0]).toEqual({
      role: "system",
      timestamp: 0,
      content: [
        { type: "text", text: "BeforeAfter", textSignature: "signature" },
      ],
      sections: { rules: "Keep these rules", skills: "Keep these skills" },
    });
    expect(moved.messages[1]).toMatchObject({
      content: [
        { type: "text", text: DOCS },
        { type: "text", text: "hello" },
      ],
    });
  });

  it("does not move custom documentation merely because its section is named docs", () => {
    const context = normalizeContext({
      messages: [
        system({ docs: "<docs>Project documentation</docs>" }),
        user("hello"),
      ],
    });
    expect(movePiDocs(context)).toBe(context);
  });

  it("does not drop instructions when there is no user message to receive them", () => {
    const context = normalizeContext({ messages: [system({ docs: DOCS })] });
    expect(movePiDocs(context)).toBe(context);
  });

  it("does not move documentation contained in user messages", () => {
    const context = normalizeContext({
      messages: [system({ rules: "Rules" }), user(DOCS)],
    });
    expect(movePiDocs(context)).toBe(context);
  });

  it("leaves unrecognized and incomplete documentation blocks intact", () => {
    const context = normalizeContext({
      systemPrompt: "<docs>Pi documentation without a closing tag",
      messages: [user("hello")],
    });
    expect(movePiDocs(context)).toBe(context);
  });

  it("leaves documentation split across text blocks unchanged rather than duplicating it", () => {
    const context = normalizeContext({
      messages: [
        {
          role: "system",
          timestamp: 0,
          content: [
            { type: "text", text: "<docs>\nPi documentation" },
            { type: "text", text: "\n</docs>" },
          ],
        },
        user("hello"),
      ],
    });
    expect(movePiDocs(context)).toBe(context);
  });

  it("does not consume a custom block after an unclosed Pi docs block", () => {
    const context = normalizeContext({
      systemPrompt:
        "<docs>Pi documentation without a closing tag\n<docs>Project documentation</docs>",
      messages: [user("hello")],
    });
    expect(movePiDocs(context)).toBe(context);
  });

  it("keeps tool declarations and custom sections intact", () => {
    const tool = {
      name: "custom",
      description: "Custom tool",
      parameters: { type: "object" as const, properties: {} },
    };
    const context = normalizeContext({
      messages: [
        {
          role: "system",
          content: DOCS,
          timestamp: 0,
          toolsAdded: [tool],
          toolsRemoved: [{ name: "old" }],
          sections: { project: "Project instructions", docs: "Custom docs" },
        },
        user("hello"),
      ],
    });
    expect(movePiDocs(context).messages[0]).toEqual({
      role: "system",
      content: "",
      timestamp: 0,
      toolsAdded: [tool],
      toolsRemoved: [{ name: "old" }],
      sections: { project: "Project instructions", docs: "Custom docs" },
    });
  });

  it("leaves a context without docs unchanged", () => {
    const context = normalizeContext({
      messages: [system({ cwd: "x" }), user("hi")],
    });
    expect(movePiDocs(context)).toBe(context);
  });
});
