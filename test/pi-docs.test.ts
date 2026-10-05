import { describe, expect, it } from "vitest";
import { mentionsPi, piDocsSection } from "../src/pi-docs.ts";

const DOCS =
  "<docs>\nPi documentation (read only when the user asks about pi itself):\n- Main documentation: /x/README.md\n</docs>";
const PROMPT = `You are an expert coding assistant.\n\n${DOCS}\n\n<cwd>\n/tmp\n</cwd>`;

describe("Pi docs", () => {
  it("extracts the docs section without its tags", () => {
    expect(piDocsSection(PROMPT)).toBe(
      "Pi documentation (read only when the user asks about pi itself):\n- Main documentation: /x/README.md",
    );
    expect(piDocsSection("no docs")).toBeUndefined();
  });

  it("detects prompts about Pi", () => {
    expect(mentionsPi("How do I write a Pi extension?")).toBe(true);
    expect(mentionsPi("Fix the pipeline and compute pi")).toBe(true);
    expect(mentionsPi("Fix the pipeline")).toBe(false);
  });
});
