import { normalizeContext, type Message } from "@earendil-works/pi-ai";
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
        system({ docs: "<docs>\nold\n</docs>" }),
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

  it("leaves a context without docs unchanged", () => {
    const context = normalizeContext({
      messages: [system({ cwd: "x" }), user("hi")],
    });
    expect(movePiDocs(context)).toBe(context);
  });
});
