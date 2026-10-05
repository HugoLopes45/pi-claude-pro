import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { billingHeader, clientHeaders } from "../src/claude-code.ts";

const VERSION = "2.1.289";

describe("billingHeader", () => {
  it("signs the version with characters 4, 7 and 20 of the first user message", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const suffix = createHash("sha256")
      .update("59cf53e54c78" + "ehu" + "2.1.289")
      .digest("hex")
      .slice(0, 3);
    expect(billingHeader(VERSION, text, true)).toBe(
      `x-anthropic-billing-header: cc_version=2.1.289.${suffix}; cc_entrypoint=pi; cch=00000;`,
    );
  });

  it("uses 0 for missing characters", () => {
    const suffix = createHash("sha256")
      .update("59cf53e54c78" + "000" + "2.1.289")
      .digest("hex")
      .slice(0, 3);
    expect(billingHeader(VERSION, "hi", true)).toContain(
      `cc_version=2.1.289.${suffix};`,
    );
  });

  it("omits cch for other hosts", () => {
    expect(billingHeader(VERSION, "", false)).not.toContain("cch=");
  });
});

describe("clientHeaders", () => {
  it("replaces identity headers whatever their case and keeps the others", () => {
    const headers = clientHeaders(
      { "User-Agent": "pi", "X-App": "pi", "x-custom": "1" },
      VERSION,
      "session-1",
    );
    expect(headers).toEqual({
      "x-custom": "1",
      "user-agent": "claude-cli/2.1.289 (external, pi)",
      "x-app": "cli",
      "x-claude-code-session-id": "session-1",
    });
  });
});
