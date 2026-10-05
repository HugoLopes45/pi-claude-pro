import { describe, expect, it } from "vitest";
import { parseLimitHeaders, parseUsageBody } from "../src/limits.ts";

const P = "anthropic-ratelimit-unified-";

describe("parseLimitHeaders", () => {
  it("returns undefined without unified headers", () => {
    expect(
      parseLimitHeaders({ "content-type": "text/plain" }, 200),
    ).toBeUndefined();
  });

  it("reads windows from an allowed response", () => {
    expect(
      parseLimitHeaders(
        {
          [`${P}status`]: "allowed",
          [`${P}5h-utilization`]: "0.42",
          [`${P}5h-reset`]: "1700000000",
          [`${P}7d-utilization`]: "0.1",
        },
        200,
      ),
    ).toEqual({
      exhausted: false,
      extraUsage: false,
      claim: undefined,
      resetsAt: undefined,
      windows: [
        { name: "5h", utilization: 0.42, resetsAt: 1700000000 },
        { name: "7d", utilization: 0.1, resetsAt: undefined },
      ],
    });
  });

  it("marks a rejected response as exhausted, case-insensitively", () => {
    const limits = parseLimitHeaders(
      {
        "Anthropic-Ratelimit-Unified-Status": "rejected",
        [`${P}representative-claim`]: "five_hour",
        [`${P}reset`]: "1700000000",
        [`${P}overage-status`]: "rejected",
      },
      429,
    );
    expect(limits).toMatchObject({
      exhausted: true,
      claim: "five_hour",
      resetsAt: 1700000000,
    });
  });

  it("treats a rejection covered by extra usage as extra usage", () => {
    const limits = parseLimitHeaders(
      { [`${P}status`]: "rejected", [`${P}overage-status`]: "allowed" },
      200,
    );
    expect(limits).toMatchObject({ exhausted: false, extraUsage: true });
  });

  it("infers a rejection from a 429 that names a claim", () => {
    const limits = parseLimitHeaders(
      { [`${P}representative-claim`]: "seven_day" },
      429,
    );
    expect(limits?.exhausted).toBe(true);
  });
});

describe("parseUsageBody", () => {
  it("does not count disabled extra usage as exhausted", () => {
    const limits = parseUsageBody({
      five_hour: { utilization: 35, resets_at: "2026-01-01T10:00:00Z" },
      seven_day: { utilization: 12, resets_at: null },
      extra_usage: { is_enabled: false, disabled_reason: "org_level_disabled" },
    });
    expect(limits).toEqual({
      exhausted: false,
      extraUsage: false,
      claim: undefined,
      resetsAt: undefined,
      windows: [
        {
          name: "5h",
          utilization: 0.35,
          resetsAt: Date.parse("2026-01-01T10:00:00Z") / 1000,
        },
        { name: "7d", utilization: 0.12, resetsAt: undefined },
      ],
    });
  });

  it("reports a spent model-specific weekly limit", () => {
    const limits = parseUsageBody({
      five_hour: { utilization: 20 },
      seven_day_opus: { utilization: 100, resets_at: "2026-01-05T00:00:00Z" },
    });
    expect(limits).toMatchObject({
      exhausted: true,
      claim: "seven_day_opus",
      resetsAt: Date.parse("2026-01-05T00:00:00Z") / 1000,
    });
  });

  it("reports a locked limit below 100%", () => {
    const limits = parseUsageBody({
      seven_day: { utilization: 60, locked_reason: "abuse" },
    });
    expect(limits).toMatchObject({ exhausted: true, claim: "seven_day" });
  });

  it("rejects bodies without usable limits", () => {
    expect(parseUsageBody(null)).toBeUndefined();
    expect(
      parseUsageBody({ five_hour: { utilization: "high" } }),
    ).toBeUndefined();
  });
});
