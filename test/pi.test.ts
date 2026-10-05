import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "sk-ant-oat01-offline-test";

interface Sent {
  url: string;
  headers: Headers;
  body: { system: { type: string; text: string }[]; messages?: unknown[] };
}

function sse(events: ({ type: string } & Record<string, unknown>)[]): string {
  return events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
}

const REPLY = sse([
  {
    type: "message_start",
    message: {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [],
      stop_reason: null,
      usage: { input_tokens: 1, output_tokens: 0 },
    },
  },
  {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  },
  {
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text: "OK" },
  },
  { type: "content_block_stop", index: 0 },
  {
    type: "message_delta",
    delta: { stop_reason: "end_turn" },
    usage: { output_tokens: 1 },
  },
  { type: "message_stop" },
]);

async function runPrompt(
  response: (url: string) => Response,
  prompts = ["Reply with exactly: OK"],
): Promise<{ sent: Sent[]; text: string }> {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      sent.push({
        url: request.url,
        headers: request.headers,
        body: request.method === "POST" ? await request.json() : { system: [] },
      });
      return response(request.url);
    }),
  );

  const agentDir = mkdtempSync(join(tmpdir(), "pi-claude-pro-agent-"));
  const cwd = mkdtempSync(join(tmpdir(), "pi-claude-pro-cwd-"));
  const settingsManager = SettingsManager.inMemory({
    retry: { enabled: false },
  });
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDir, "auth.json"),
    modelsPath: join(agentDir, "models.json"),
  });
  await modelRuntime.setRuntimeApiKey("anthropic", TOKEN);
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    additionalExtensionPaths: [
      resolve(import.meta.dirname, "../extensions/index.ts"),
    ],
  });
  await resourceLoader.reload();
  expect(resourceLoader.getExtensions().errors).toEqual([]);

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    model: getBuiltinModel("anthropic", "claude-haiku-4-5"),
    thinkingLevel: "off",
    modelRuntime,
    resourceLoader,
    settingsManager,
    sessionManager: SessionManager.inMemory(cwd),
    tools: [],
  });
  try {
    for (const prompt of prompts) await session.prompt(prompt);
    const last = session.messages.at(-1);
    const text =
      last?.role === "assistant"
        ? (last.errorMessage ??
          last.content
            .map((block) => (block.type === "text" ? block.text : ""))
            .join(""))
        : "";
    return { sent, text };
  } finally {
    session.dispose();
  }
}

describe("inside Pi", () => {
  let path: string | undefined;

  beforeEach(() => {
    const bin = mkdtempSync(join(tmpdir(), "pi-claude-pro-bin-"));
    const claude = join(bin, "claude");
    writeFileSync(claude, "#!/bin/sh\necho '2.1.289 (Claude Code)'\n");
    chmodSync(claude, 0o755);
    path = process.env.PATH;
    process.env.PATH = `${bin}${delimiter}${path ?? ""}`;
  });

  afterEach(() => {
    process.env.PATH = path;
    vi.unstubAllGlobals();
  });

  it("sends a subscription request as Claude Code", async () => {
    const { sent, text } = await runPrompt(
      () =>
        new Response(REPLY, {
          headers: { "content-type": "text/event-stream" },
        }),
    );
    expect(text).toBe("OK");
    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request?.url).toBe(
      "https://api.anthropic.com/v1/messages?beta=true",
    );
    expect(request?.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(request?.headers.get("user-agent")).toBe(
      "claude-cli/2.1.289 (external, pi)",
    );
    expect(request?.headers.get("x-app")).toBe("cli");
    expect(request?.headers.get("x-claude-code-session-id")).toBeTruthy();
    const system = request?.body.system.map((block) => block.text) ?? [];
    expect(system[0]).toMatch(
      /^x-anthropic-billing-header: cc_version=2\.1\.289\.[0-9a-f]{3}; cc_entrypoint=pi; cch=00000;$/,
    );
    expect(system).not.toContain(
      "You are Claude Code, Anthropic's official CLI for Claude.",
    );
    expect(system.join("\n")).not.toContain("Pi documentation");
    expect(system.slice(1).join("\n")).toContain("operating inside pi");
  });

  it("explains an exhausted subscription instead of retrying", async () => {
    const { sent, text } = await runPrompt(
      () =>
        new Response(
          JSON.stringify({
            type: "error",
            error: { type: "rate_limit_error", message: "Error" },
          }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "anthropic-ratelimit-unified-status": "rejected",
              "anthropic-ratelimit-unified-representative-claim": "five_hour",
            },
          },
        ),
    );
    expect(text).toBe("Claude 5-hour limit reached");
    expect(
      sent.filter((request) => request.url.includes("/v1/messages")),
    ).toHaveLength(1);
  });

  it("asks the usage endpoint when a 429 does not say which limit is spent", async () => {
    const { sent, text } = await runPrompt((url) =>
      url.endsWith("/api/oauth/usage")
        ? Response.json({
            five_hour: { utilization: 100, resets_at: null },
            seven_day: { utilization: 40, resets_at: null },
          })
        : Response.json(
            {
              type: "error",
              error: { type: "rate_limit_error", message: "Error" },
            },
            { status: 429, headers: { "retry-after": "0" } },
          ),
    );
    expect(text).toBe("Claude 5-hour limit reached");
    const usage = sent.filter((request) =>
      request.url.endsWith("/api/oauth/usage"),
    );
    expect(usage).toHaveLength(1);
    expect(usage[0]?.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(usage[0]?.headers.get("anthropic-beta")).toBe("oauth-2025-04-20");
    expect(
      sent.filter((request) => request.url.includes("/v1/messages")),
    ).toHaveLength(1);
  });

  it("gives Pi's docs back once when the user asks about Pi", async () => {
    const ok = () =>
      new Response(REPLY, { headers: { "content-type": "text/event-stream" } });
    const { sent } = await runPrompt(ok, [
      "How do I write a pi extension?",
      "And a pi theme?",
    ]);
    const docsCount = (request: Sent | undefined) =>
      JSON.stringify(request?.body.messages).split(
        "Pi documentation (read only",
      ).length - 1;
    expect(sent).toHaveLength(2);
    expect(docsCount(sent[0])).toBe(1);
    expect(docsCount(sent[1])).toBe(1);
    expect(
      sent[0]?.body.system.map((block) => block.text).join("\n"),
    ).not.toContain("Pi documentation");
  });
});
