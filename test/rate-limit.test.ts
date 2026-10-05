import { describe, expect, it, vi } from "vitest";
import {
  createRateLimits,
  type RateLimitDeps,
  type RequestAuth,
} from "../src/rate-limit.ts";

const auth: RequestAuth = {
  accessToken: "sk-ant-oat01-test",
  headers: { "x-app": "cli" },
  signal: undefined,
  modelId: "claude-sonnet-4-5",
};
const spentBody = { five_hour: { utilization: 100 } };
const freeBody = { five_hour: { utilization: 20 } };

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
  it("recognizes exhausted extra usage in a 400 without consuming its body", async () => {
    const fetchUsage = vi.fn();
    const onLimits = vi.fn();
    const watch = watcher({ fetchUsage, onLimits })(auth);
    const body = {
      type: "error",
      error: {
        type: "invalid_request_error",
        message:
          "You're out of extra usage. Add more at claude.ai/settings/usage and keep going.",
      },
    };
    const response = await watch.inspect(Response.json(body, { status: 400 }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(body);
    expect(response.headers.get("x-should-retry")).toBe("false");
    expect(watch.explain("400 invalid_request_error")).toBe(
      "Claude extra usage limit reached",
    );
    expect(onLimits).toHaveBeenCalledWith({
      exhausted: true,
      extraUsage: false,
      claim: "overage",
      windows: [],
    });
    expect(fetchUsage).not.toHaveBeenCalled();
    await watch.inspect(reply(200));
    expect(watch.explain("another error")).toBe("another error");
  });

  it.each([
    "not JSON",
    "null",
    JSON.stringify({
      type: "error",
      error: { type: "invalid_request_error", message: "Invalid model" },
    }),
    JSON.stringify({
      type: "error",
      error: { type: "invalid_request_error", message: 42 },
    }),
  ])("preserves unrelated or malformed 400 bodies: %s", async (body) => {
    const fetchUsage = vi.fn();
    const watch = watcher({ fetchUsage })(auth);
    const response = new Response(body, { status: 400 });
    expect(await watch.inspect(response)).toBe(response);
    expect(await response.text()).toBe(body);
    expect(watch.explain("original error")).toBe("original error");
    expect(fetchUsage).not.toHaveBeenCalled();
  });

  it("leaves successful responses alone", async () => {
    const fetchUsage = vi.fn(async () => spentBody);
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
    const fetchUsage = vi.fn(async () => spentBody);
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

  it("does not reuse the cached usage of another account", async () => {
    const other = { ...auth, accessToken: "sk-ant-oat01-other" };
    const fetchUsage = vi.fn(async ({ accessToken }: RequestAuth) =>
      accessToken === auth.accessToken ? spentBody : freeBody,
    );
    const watchRequest = watcher({ fetchUsage });

    await watchRequest(auth).inspect(reply(429));
    const watch = watchRequest(other);
    const response = await watch.inspect(reply(429));

    expect(fetchUsage).toHaveBeenLastCalledWith(other);
    expect(response.headers.get("x-should-retry")).toBeNull();
    expect(watch.explain("429 rate_limit_error")).toBe("429 rate_limit_error");
  });

  it("judges the cached usage against the model of each request", async () => {
    const fetchUsage = vi.fn(async () => ({
      five_hour: { utilization: 20 },
      seven_day_opus: { utilization: 100 },
    }));
    const watchRequest = watcher({ fetchUsage });

    const opus = watchRequest({ ...auth, modelId: "claude-opus-4-1" });
    await opus.inspect(reply(429));
    const sonnet = watchRequest(auth);
    await sonnet.inspect(reply(429));

    expect(fetchUsage).toHaveBeenCalledTimes(1);
    expect(opus.explain("429")).toBe("Claude weekly Opus limit reached");
    expect(sonnet.explain("429")).toBe("429");
  });

  it("keeps a transient 429 retryable", async () => {
    const watch = watcher({ fetchUsage: async () => freeBody })(auth);
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
    const watch = watcher({ fetchUsage: async () => spentBody })(auth);
    await watch.inspect(reply(429));
    await watch.inspect(reply(200));
    expect(watch.explain("stream ended")).toBe("stream ended");
  });
});
