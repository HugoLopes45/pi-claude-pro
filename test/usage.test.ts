import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUsage } from "../src/usage.ts";

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetch = vi.fn(
    async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response("{}", { headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const auth = {
  accessToken: "sk-ant-oat01-token",
  headers: {},
  signal: undefined,
  modelId: "claude-test",
  firstParty: true,
};

describe("fetchUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends only the subscription token as authorization", async () => {
    const fetch = stubFetch();
    await fetchUsage({
      ...auth,
      headers: { Authorization: "Bearer other", "x-app": "cli" },
    });
    const init = fetch.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-ant-oat01-token");
    expect(headers.get("x-app")).toBe("cli");
  });

  it("stops waiting when the caller aborts", async () => {
    const fetch = stubFetch();
    const controller = new AbortController();
    await fetchUsage({ ...auth, signal: controller.signal });
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    controller.abort();
    expect(signal?.aborted).toBe(true);
  });

  it("has a deadline without a caller signal", async () => {
    const fetch = stubFetch();
    await fetchUsage(auth);
    expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
