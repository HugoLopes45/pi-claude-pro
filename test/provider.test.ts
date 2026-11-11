import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type Model,
  type SimpleStreamOptions,
  normalizeContext,
  type TranscriptContext,
} from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { createProviderStream, type ProviderDeps } from "../src/provider.ts";

const model: Model<Api> = {
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
const context = normalizeContext({ messages: [] });
const TOKEN = "sk-ant-oat01-test";
const CONTINUATION = {
  messages: [{ role: "user", content: "tool result" }],
  thread: { type: "continue", previous_message_id: "msg_1" },
};

function message(
  stopReason: "stop" | "error",
  errorMessage?: string,
): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    errorMessage,
    timestamp: 0,
  };
}

interface Call {
  model: Model<Api>;
  options: SimpleStreamOptions | undefined;
}

/** Fake Anthropic adapter: runs the payload hook, fetches once, then ends. */
function fakeAdapter(body = "{}") {
  const calls: Call[] = [];
  const payloads: unknown[] = [];
  const stream = (
    m: Model<Api>,
    _c: TranscriptContext,
    options?: SimpleStreamOptions,
  ) => {
    calls.push({ model: m, options });
    const out = createAssistantMessageEventStream();
    void (async () => {
      payloads.push(
        await options?.onPayload?.(
          {
            system: [
              {
                type: "text",
                text: "You are Claude Code, Anthropic's official CLI for Claude.",
              },
              { type: "text", text: "Prompt" },
            ],
            messages: [{ role: "user", content: "hello" }],
          },
          m,
        ),
      );
      if (!options?.fetch) throw new Error("fetch missing");
      const response = await options.fetch(
        "https://api.anthropic.com/v1/messages",
        { body },
      );
      out.push(
        response.ok
          ? { type: "done", reason: "stop", message: message("stop") }
          : {
              type: "error",
              reason: "error",
              error: message("error", `${response.status} rate_limit_error`),
            },
      );
      out.end();
    })();
    return out;
  };
  return { stream, calls, payloads };
}

function piFetch(status: number, headers: Record<string, string> = {}) {
  return async () => new Response("{}", { status, headers });
}

function deps(overrides: Partial<ProviderDeps>): ProviderDeps {
  return {
    stream: fakeAdapter().stream,
    claudeCodeVersion: () => "2.1.289",
    contextWindows: new Map([["claude-test", 1_000_000]]),
    watchRequest: () => ({
      inspect: async (response) => response,
      explain: (text) => text,
    }),
    ...overrides,
  };
}

describe("createProviderStream", () => {
  it("passes API-key requests through unchanged", async () => {
    const adapter = fakeAdapter();
    const options = {
      apiKey: "sk-ant-api03-x",
      headers: { "x-app": "pi" },
      fetch: piFetch(200),
    };
    const original = normalizeContext({
      systemPrompt: "<docs>\nPi documentation\n</docs>\nCustom rules",
      messages: [{ role: "user", content: "hello", timestamp: 0 }],
    });
    const result = await createProviderStream(
      deps({
        stream: (m, sentContext, sentOptions) => {
          expect(sentContext).toBe(original);
          return adapter.stream(m, sentContext, sentOptions);
        },
      }),
    )(model, original, options).result();
    expect(result.stopReason).toBe("stop");
    expect(adapter.calls[0]).toEqual({ model, options });
  });

  it("sends subscription requests as Claude Code", async () => {
    const adapter = fakeAdapter();
    const seen: unknown[] = [];
    const stream = createProviderStream(deps({ stream: adapter.stream }));
    const result = await stream(model, context, {
      apiKey: TOKEN,
      sessionId: "s1",
      headers: { "X-App": "pi" },
      fetch: piFetch(200),
      onPayload: (payload) => {
        seen.push(payload);
        return undefined;
      },
    }).result();

    expect(result.stopReason).toBe("stop");
    const call = adapter.calls[0];
    expect(call?.model.contextWindow).toBe(1_000_000);
    expect(call?.options?.headers).toEqual({
      "user-agent": "claude-cli/2.1.289 (external, pi)",
      "x-app": "cli",
      "x-claude-code-session-id": "s1",
    });
    expect(seen).toHaveLength(1);
    expect(adapter.payloads[0]).toMatchObject({
      system: [
        {
          type: "text",
          text: expect.stringMatching(
            /^x-anthropic-billing-header: cc_version=2\.1\.289\.[0-9a-f]{3}; cc_entrypoint=pi; cch=00000;$/,
          ),
        },
        { type: "text", text: "Prompt" },
      ],
    });
  });

  it("sends the billing block on thread continuations", async () => {
    const bodies: unknown[] = [];
    await createProviderStream(
      deps({ stream: fakeAdapter(JSON.stringify(CONTINUATION)).stream }),
    )(model, context, {
      apiKey: TOKEN,
      fetch: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response("{}", { status: 200 });
      },
    }).result();

    // "hello" samples "o00": sha256("59cf53e54c78o002.1.289") starts with 7e2.
    expect(bodies).toEqual([
      {
        ...CONTINUATION,
        system: [
          {
            type: "text",
            text: "x-anthropic-billing-header: cc_version=2.1.289.7e2; cc_entrypoint=pi; cch=00000;",
          },
        ],
      },
    ]);
  });

  it("sends requests without a thread unchanged, as older Pi does", async () => {
    const body = JSON.stringify({ messages: [] });
    const sent: unknown[] = [];
    await createProviderStream(deps({ stream: fakeAdapter(body).stream }))(
      model,
      context,
      {
        apiKey: TOKEN,
        fetch: async (_input, init) => {
          sent.push(init?.body);
          return new Response("{}", { status: 200 });
        },
      },
    ).result();
    expect(sent).toEqual([body]);
  });

  it("retries once at the Claude Code version a model requires, then keeps it", async () => {
    const tooOld = Response.json(
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message:
            "Claude Code 2.1.289 does not support this model; version 2.1.400 or newer is required. Run 'claude update'.",
          details: { error_code: "claude_code_version_too_old" },
        },
      },
      { status: 400 },
    );
    const responses = [tooOld, new Response("{}"), new Response("{}")];
    const sent: string[] = [];
    const userAgents: unknown[] = [];
    const stream = createProviderStream(
      deps({
        stream: (m, _c, options) => {
          userAgents.push(options?.headers?.["user-agent"]);
          const out = createAssistantMessageEventStream();
          void (async () => {
            const payload = await options?.onPayload?.(
              { messages: [{ role: "user", content: "hello" }] },
              m,
            );
            if (!options?.fetch) throw new Error("fetch missing");
            const response = await options.fetch("https://api.anthropic.com", {
              body: JSON.stringify(payload),
            });
            out.push({
              type: "done",
              reason: "stop",
              message: message(response.ok ? "stop" : "error"),
            });
            out.end();
          })();
          return out;
        },
      }),
    );
    const options = {
      apiKey: TOKEN,
      fetch: async (_input: unknown, init?: RequestInit) => {
        sent.push(String(init?.body));
        const response = responses.shift();
        if (!response) throw new Error("unexpected request");
        return response;
      },
    };

    const first = await stream(model, context, options).result();
    await stream(model, context, options).result();

    expect(first.stopReason).toBe("stop");
    const versions = sent.map(
      (body) => /cc_version=([\d.]+)\./.exec(body)?.[1],
    );
    expect(versions).toEqual(["2.1.289", "2.1.400", "2.1.400"]);
    expect(userAgents).toEqual([
      "claude-cli/2.1.289 (external, pi)",
      "claude-cli/2.1.400 (external, pi)",
    ]);
  });

  it("fails visibly when the Claude Code version is unreadable", async () => {
    const adapter = fakeAdapter();
    const stream = createProviderStream(
      deps({
        stream: adapter.stream,
        claudeCodeVersion: () => {
          throw new Error("cannot run claude --version");
        },
      }),
    );
    const result = await stream(model, context, { apiKey: TOKEN }).result();
    expect(result.errorMessage).toBe("cannot run claude --version");
    expect(adapter.calls).toHaveLength(0);
  });

  it("routes responses and errors through the request watch", async () => {
    const adapter = fakeAdapter();
    const inspected: number[] = [];
    const stream = createProviderStream(
      deps({
        stream: adapter.stream,
        watchRequest: (auth) => {
          expect(auth.accessToken).toBe(TOKEN);
          return {
            inspect: async (response) => {
              inspected.push(response.status);
              return response;
            },
            explain: (text) => `explained: ${text}`,
          };
        },
      }),
    );
    const result = await stream(model, context, {
      apiKey: TOKEN,
      fetch: piFetch(429),
    }).result();
    expect(inspected).toEqual([429]);
    expect(result.errorMessage).toBe("explained: 429 rate_limit_error");
  });
});
