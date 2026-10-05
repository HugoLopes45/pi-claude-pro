import { describe, expect, it, vi } from "vitest";
import type { Limits } from "../src/limits.ts";
import { createRateLimits, type RateLimitDeps } from "../src/rate-limit.ts";

const auth = {
  accessToken: "sk-ant-oat01-test",
  headers: { "x-app": "cli" },
  signal: undefined,
};
const spent: Limits = {
  exhausted: true,
  extraUsage: false,
  claim: "five_hour",
  windows: [],
};

function watcher(overrides: Partial<RateLimitDeps>) {
  return createRateLimits({
    fetchUsage: async () => undefined,
    onLimits: () => {},
    now: () => 0,
    ...overrides,
  });
}

function reply(status: number, headers: Record<string, string> = {}): Response {
  return new Response("{}", { status, headers });
}

describe("createRateLimits", () => {
  it("leaves successful responses alone", async () => {
    const fetchUsage = vi.fn(async () => spent);
    const watch = watcher({ fetchUsage })(auth);
    const response = reply(200);
    expect(await watch.inspect(response)).toBe(response);
    expect(watch.explain("boom")).toBe("boom");
    expect(fetchUsage).not.toHaveBeenCalled();
  });

  it("explains an exhausted subscription from the 429 headers and stops retries", async () => {
    const fetchUsage = vi.fn(async () => undefined);
    const onLimits = vi.fn();
    const watch = watcher({ fetchUsage, onLimits })(auth);
    const response = await watch.inspect(
      reply(429, {
        "anthropic-ratelimit-unified-status": "rejected",
        "anthropic-ratelimit-unified-representative-claim": "seven_day",
      }),
    );
    expect(response.headers.get("x-should-retry")).toBe("false");
    expect(watch.explain("429 rate_limit_error")).toBe(
      "Claude weekly limit reached",
    );
    expect(fetchUsage).not.toHaveBeenCalled();
    expect(onLimits).toHaveBeenCalledWith(
      expect.objectContaining({ exhausted: true }),
    );
  });

  it("asks the usage endpoint when the 429 headers are not conclusive, and caches it", async () => {
    const fetchUsage = vi.fn(async () => spent);
    let time = 0;
    const watchRequest = watcher({ fetchUsage, now: () => time });

    const first = watchRequest(auth);
    await first.inspect(reply(429));
    time = 29_000;
    await watchRequest(auth).inspect(reply(429));
    time = 31_000;
    await watchRequest(auth).inspect(reply(429));

    expect(first.explain("429")).toBe("Claude 5-hour limit reached");
    expect(fetchUsage).toHaveBeenCalledTimes(2);
    expect(fetchUsage).toHaveBeenCalledWith(auth);
  });

  it("keeps a transient 429 retryable", async () => {
    const watch = watcher({
      fetchUsage: async () => ({
        ...spent,
        exhausted: false,
        claim: undefined,
      }),
    })(auth);
    const response = await watch.inspect(reply(429));
    expect(response.headers.get("x-should-retry")).toBeNull();
    expect(watch.explain("429 rate_limit_error")).toBe("429 rate_limit_error");
  });

  it("reports a failed usage lookup in the error", async () => {
    const watch = watcher({
      fetchUsage: async () => {
        throw new Error("usage endpoint returned HTTP 500");
      },
    })(auth);
    await watch.inspect(reply(429));
    expect(watch.explain("429 rate_limit_error")).toBe(
      "429 rate_limit_error (usage lookup failed: usage endpoint returned HTTP 500)",
    );
  });

  it("forgets a 429 once a later attempt gets through", async () => {
    const watch = watcher({ fetchUsage: async () => spent })(auth);
    await watch.inspect(reply(429));
    await watch.inspect(reply(200));
    expect(watch.explain("stream ended")).toBe("stream ended");
  });
});
