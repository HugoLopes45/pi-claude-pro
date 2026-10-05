// Sends one real request to Anthropic with the Pi login on this machine, and
// checks that Anthropic bills it to the subscription. Costs one small request.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const ALLOWED = new Set(["allowed", "allowed_warning"]);

const responses: Response[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const response = await realFetch(input, init);
  if (new Request(input, init).url.includes("/v1/messages"))
    responses.push(response.clone());
  return response;
};

const cwd = mkdtempSync(join(tmpdir(), "pi-claude-pro-live-"));
const agentDir = getAgentDir();
const settingsManager = SettingsManager.inMemory({ retry: { enabled: false } });
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

const { session } = await createAgentSession({
  cwd,
  agentDir,
  model: getBuiltinModel("anthropic", "claude-haiku-4-5"),
  thinkingLevel: "off",
  resourceLoader,
  settingsManager,
  sessionManager: SessionManager.inMemory(cwd),
  tools: [],
});

const failures: string[] = [];
try {
  if (!session.modelRuntime.isUsingOAuth("anthropic")) {
    failures.push(
      "Pi has no Claude subscription login. Run /login in Pi and select Anthropic (Claude Pro/Max).",
    );
  } else {
    await session.prompt("Reply with exactly: OK");
    const last = session.messages.at(-1);
    const response = responses.at(-1);
    const status = response?.headers.get("anthropic-ratelimit-unified-status");
    console.log(`HTTP ${response?.status ?? "none"}, unified status ${status}`);
    if (last?.role !== "assistant") failures.push("Request failed: no reply");
    else if (last.stopReason === "error")
      failures.push(`Request failed: ${last.errorMessage}`);
    if (!status || !ALLOWED.has(status))
      failures.push(
        `Anthropic did not bill the request to the subscription (unified status: ${status}).`,
      );
  }
} finally {
  session.dispose();
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log("Anthropic accepted the request as a subscription request.");
