import { describe, expect, it } from "vitest";
import { firstUserText, rewriteSystem } from "../src/payload.ts";

const IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";
const PROMPT = "You are an expert coding assistant.\n\n<cwd>\n/tmp\n</cwd>";
const cache = { type: "ephemeral" };

describe("rewriteSystem", () => {
  it("puts billing first and drops the identity line", () => {
    const payload = {
      model: "m",
      system: [
        { type: "text", text: IDENTITY, cache_control: cache },
        { type: "text", text: PROMPT, cache_control: cache },
      ],
    };
    expect(rewriteSystem(payload, "BILLING")).toEqual({
      model: "m",
      system: [
        { type: "text", text: "BILLING" },
        {
          type: "text",
          text: PROMPT,
          cache_control: cache,
        },
      ],
    });
  });

  it("replaces an earlier billing block instead of adding a second one", () => {
    const once = rewriteSystem(
      { system: [{ type: "text", text: PROMPT }] },
      "x-anthropic-billing-header: a;",
    );
    const twice = rewriteSystem(once, "x-anthropic-billing-header: b;");
    expect(twice).toEqual({
      system: [
        { type: "text", text: "x-anthropic-billing-header: b;" },
        {
          type: "text",
          text: PROMPT,
        },
      ],
    });
  });

  it("keeps the identity line when it is the whole prompt", () => {
    const payload = { system: [{ type: "text", text: IDENTITY }] };
    expect(rewriteSystem(payload, "BILLING")).toEqual({
      system: [
        { type: "text", text: "BILLING" },
        { type: "text", text: IDENTITY },
      ],
    });
  });

  it("accepts a string system prompt", () => {
    expect(rewriteSystem({ system: "Hello" }, "BILLING")).toEqual({
      system: [
        { type: "text", text: "BILLING" },
        { type: "text", text: "Hello" },
      ],
    });
  });
});

describe("firstUserText", () => {
  it("joins the text blocks of the first user message", () => {
    const payload = {
      messages: [
        { role: "assistant", content: "no" },
        {
          role: "user",
          content: [
            { type: "text", text: "one" },
            { type: "image" },
            { type: "text", text: "two" },
          ],
        },
        { role: "user", content: "later" },
      ],
    };
    expect(firstUserText(payload)).toBe("one\ntwo");
  });

  it("returns an empty string without messages", () => {
    expect(firstUserText({})).toBe("");
  });
});
