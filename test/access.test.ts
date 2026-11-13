import type { Api, Model } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { checkAccess, type AuthSource } from "../src/access.ts";

const claude: Model<Api> = {
  id: "claude-test",
  name: "Claude Test",
  api: "anthropic-messages",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 100_000,
  maxTokens: 8_000,
};

function source(
  apiKey: string | undefined,
  { configured = true, error = "" } = {},
): AuthSource {
  return {
    hasConfiguredAuth: () => configured,
    getApiKeyAndHeaders: async () =>
      error ? { ok: false, error } : { ok: true, apiKey, headers: { a: "b" } },
  };
}

describe("checkAccess", () => {
  it("finds a subscription login and its token", async () => {
    expect(await checkAccess(source("sk-ant-oat01-x"), claude)).toEqual({
      kind: "subscription",
      accessToken: "sk-ant-oat01-x",
      headers: { a: "b" },
      firstParty: true,
    });
  });

  it("marks a login behind a proxy", async () => {
    expect(
      await checkAccess(source("sk-ant-oat01-x"), {
        ...claude,
        baseUrl: "https://proxy.example.com",
      }),
    ).toMatchObject({ kind: "subscription", firstParty: false });
  });

  it("finds a subscription token stored as a key", async () => {
    expect((await checkAccess(source("sk-ant-oat01-x"), claude)).kind).toBe(
      "subscription",
    );
  });

  it("tells an API key from a subscription", async () => {
    expect(await checkAccess(source("sk-ant-api03-x"), claude)).toEqual({
      kind: "api-key",
    });
  });

  it("reports a missing login", async () => {
    expect(
      await checkAccess(source(undefined, { configured: false }), claude),
    ).toEqual({ kind: "no-login" });
  });

  it("trusts a resolved login before Pi lists it as configured", async () => {
    expect(
      (
        await checkAccess(
          source("sk-ant-oat01-x", { configured: false }),
          claude,
        )
      ).kind,
    ).toBe("subscription");
  });

  it("reports a missing login when Pi resolves no key", async () => {
    expect(await checkAccess(source(undefined), claude)).toEqual({
      kind: "no-login",
    });
    expect(
      await checkAccess(
        source(undefined, { configured: false, error: "No API key found" }),
        claude,
      ),
    ).toEqual({ kind: "no-login" });
  });

  it("reports a login that cannot be read", async () => {
    expect(
      await checkAccess(source(undefined, { error: "refresh failed" }), claude),
    ).toEqual({ kind: "auth-error", error: "refresh failed" });
  });

  it("ignores other providers", async () => {
    expect(
      await checkAccess(source("sk-ant-oat01-x"), {
        ...claude,
        provider: "openai",
      }),
    ).toEqual({ kind: "other-provider" });
    expect(await checkAccess(source("sk-ant-oat01-x"), undefined)).toEqual({
      kind: "other-provider",
    });
  });
});
