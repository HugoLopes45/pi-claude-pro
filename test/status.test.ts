import { isRetryableAssistantError } from "@earendil-works/pi-ai/compat";
import { describe, expect, it } from "vitest";
import { exhaustedMessage, footer, formatReset } from "../src/status.ts";

describe("messages", () => {
  const now = new Date(2026, 0, 1, 12, 0).getTime();
  const soon = new Date(2026, 0, 1, 17, 5).getTime() / 1000;
  const later = new Date(2026, 0, 3, 9, 30).getTime() / 1000;

  it("formats near resets as a time and far resets with the weekday", () => {
    expect(formatReset(soon, now)).toBe("17:05");
    expect(formatReset(later, now)).toBe("Sat 09:30");
  });

  it("names the spent limit and its reset, without making Pi retry", () => {
    const text = exhaustedMessage(
      {
        exhausted: true,
        extraUsage: false,
        claim: "seven_day",
        resetsAt: later,
        windows: [],
      },
      now,
    );
    expect(text).toBe("Claude weekly limit reached · resets Sat 09:30");
    const message = {
      role: "assistant" as const,
      content: [],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "m",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "error" as const,
      errorMessage: text,
      timestamp: 0,
    };
    expect(isRetryableAssistantError(message)).toBe(false);
  });

  it("shows the ready status when no usage is known", () => {
    expect(
      footer({ exhausted: false, extraUsage: false, windows: [] }),
    ).toEqual({
      text: "Claude Pro",
      level: "success",
    });
  });

  it("warns from 80% utilization", () => {
    expect(
      footer({
        exhausted: false,
        extraUsage: false,
        windows: [{ name: "5h", utilization: 0.81 }],
      }),
    ).toEqual({ text: "Claude 5h 81%", level: "warning" });
    expect(
      footer({
        exhausted: false,
        extraUsage: false,
        windows: [
          { name: "5h", utilization: 0.2 },
          { name: "7d", utilization: 0.5 },
        ],
      }),
    ).toEqual({ text: "Claude 5h 20% · 7d 50%", level: "success" });
  });
});
