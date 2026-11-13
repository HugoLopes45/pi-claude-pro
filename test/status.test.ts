import { isRetryableAssistantError } from "@earendil-works/pi-ai/compat";
import { describe, expect, it } from "vitest";
import {
  accessFooter,
  exhaustedMessage,
  footer,
  formatReset,
  statusReport,
} from "../src/status.ts";

function retried(errorMessage: string): boolean {
  return isRetryableAssistantError({
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
    errorMessage,
    timestamp: 0,
  });
}

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
    expect(retried(text)).toBe(false);
  });

  it("names the spent Fable limit, not the weekly limit", () => {
    const text = exhaustedMessage({
      exhausted: true,
      extraUsage: false,
      claim: "seven_day_overage_included",
      windows: [],
    });
    expect(text).toBe("Claude weekly Fable limit reached");
    expect(retried(text)).toBe(false);
  });

  it("shows the ready status when no usage is known", () => {
    expect(
      footer({ exhausted: false, extraUsage: false, windows: [] }),
    ).toEqual({
      text: "Claude plan",
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

describe("access footer", () => {
  it("points to the fix when the plan is not used", () => {
    expect(accessFooter("subscription")).toEqual({
      text: "Claude plan",
      level: "success",
    });
    expect(accessFooter("no-login")).toEqual({
      text: "Claude: /login",
      level: "warning",
    });
    expect(accessFooter("api-key")).toEqual({
      text: "Claude API key · /claude-pro",
      level: "warning",
    });
    expect(accessFooter("auth-error")).toEqual({
      text: "Claude login failed · /claude-pro",
      level: "error",
    });
    expect(accessFooter("other-provider")).toBeUndefined();
  });
});

describe("status report", () => {
  const now = new Date(2026, 0, 1, 12, 0).getTime();
  const soon = new Date(2026, 0, 1, 17, 5).getTime() / 1000;
  const later = new Date(2026, 0, 3, 9, 30).getTime() / 1000;
  const base = { model: "anthropic/claude-test" };

  it("lists each limit with its reset", () => {
    expect(
      statusReport(
        {
          ...base,
          kind: "subscription",
          limits: {
            exhausted: false,
            extraUsage: false,
            windows: [
              { name: "5h", utilization: 0.42, resetsAt: soon },
              { name: "7d", utilization: 0.1, resetsAt: later },
              { name: "Fable", utilization: 0.3 },
            ],
          },
        },
        now,
      ),
    ).toEqual({
      level: "info",
      text: [
        "pi-claude-pro is active: anthropic/claude-test uses your Claude plan.",
        "5-hour limit: 42% · resets 17:05",
        "Weekly limit: 10% · resets Sat 09:30",
        "Weekly Fable limit: 30%",
      ].join("\n"),
    });
  });

  it("warns near a limit and errors on a spent one", () => {
    const near = statusReport({
      ...base,
      kind: "subscription",
      limits: {
        exhausted: false,
        extraUsage: false,
        windows: [{ name: "5h", utilization: 0.9 }],
      },
    });
    expect(near.level).toBe("warning");
    const spent = statusReport(
      {
        ...base,
        kind: "subscription",
        limits: {
          exhausted: true,
          extraUsage: false,
          claim: "five_hour",
          resetsAt: soon,
          windows: [],
        },
      },
      now,
    );
    expect(spent.level).toBe("error");
    expect(spent.text).toContain("Claude 5-hour limit reached · resets 17:05");
  });

  it("says when extra usage pays for requests", () => {
    const report = statusReport({
      ...base,
      kind: "subscription",
      limits: { exhausted: false, extraUsage: true, windows: [] },
    });
    expect(report.level).toBe("warning");
    expect(report.text).toContain(
      "Requests are billed as extra usage, per token.",
    );
  });

  it("names the likely cause when extra usage bills a plan with room", () => {
    const cause =
      "Your plan limits are not reached. The model may need usage credits on your plan, or Anthropic classified the request as a third-party app.";
    const billed = statusReport({
      ...base,
      kind: "subscription",
      limits: {
        exhausted: false,
        extraUsage: true,
        windows: [{ name: "5h", utilization: 0.35 }],
      },
    });
    expect(billed.text).toContain(cause);
    const empty = statusReport({
      ...base,
      kind: "subscription",
      limits: {
        exhausted: true,
        extraUsage: false,
        claim: "overage",
        windows: [{ name: "5h", utilization: 0.35 }],
      },
    });
    expect(empty.level).toBe("error");
    expect(empty.text).toContain("Claude extra usage limit reached");
    expect(empty.text).toContain(cause);
    const spent = statusReport({
      ...base,
      kind: "subscription",
      limits: {
        exhausted: false,
        extraUsage: true,
        windows: [{ name: "5h", utilization: 1 }],
      },
    });
    expect(spent.text).not.toContain(cause);
    const opus = statusReport({
      ...base,
      kind: "subscription",
      limits: {
        exhausted: false,
        extraUsage: true,
        claim: "seven_day_opus",
        windows: [{ name: "5h", utilization: 0.35 }],
      },
    });
    expect(opus.text).not.toContain(cause);
  });

  it("explains missing usage", () => {
    expect(
      statusReport({ ...base, kind: "subscription", usageError: "HTTP 429" }),
    ).toEqual({
      level: "warning",
      text: [
        "pi-claude-pro is active: anthropic/claude-test uses your Claude plan.",
        "Usage: unavailable (HTTP 429)",
      ].join("\n"),
    });
    expect(statusReport({ ...base, kind: "subscription" }).text).toContain(
      "Usage: shown after the next request",
    );
  });

  it("tells how to fix an inactive extension", () => {
    const login =
      'Run /login and select "Anthropic (Claude Pro/Max)". If it is missing, run `pi list` and remove other Claude extensions.';
    expect(statusReport({ ...base, kind: "api-key" })).toEqual({
      level: "warning",
      text: `pi-claude-pro is inactive: anthropic/claude-test uses an Anthropic API key, billed per token.\n${login}`,
    });
    expect(statusReport({ ...base, kind: "no-login" })).toEqual({
      level: "warning",
      text: `pi-claude-pro is inactive: Anthropic has no login.\n${login}`,
    });
    expect(
      statusReport({ ...base, kind: "auth-error", error: "expired" }),
    ).toEqual({
      level: "error",
      text: `pi-claude-pro is inactive: the Anthropic login failed (expired).\n${login}`,
    });
    expect(statusReport({ ...base, kind: "other-provider" })).toEqual({
      level: "info",
      text: "pi-claude-pro is inactive: the current model is not a Claude model.\nSelect a Claude model with /model.",
    });
  });
});
