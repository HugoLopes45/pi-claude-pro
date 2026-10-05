import { anthropicMessagesApi } from "@earendil-works/pi-ai/compat";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { readClaudeCodeVersion } from "../src/claude-code.ts";
import { parseLimitHeaders, type Limits } from "../src/limits.ts";
import { createProviderStream, isSubscriptionToken } from "../src/provider.ts";
import { createRateLimits } from "../src/rate-limit.ts";
import { footer, READY, type Footer } from "../src/status.ts";
import { fetchUsage } from "../src/usage.ts";

const STATUS_KEY = "claude-pro";

async function usesSubscription(ctx: ExtensionContext): Promise<boolean> {
  const model = ctx.model;
  if (model?.provider !== "anthropic") return false;
  if (ctx.modelRegistry.isUsingOAuth(model)) return true;
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  return auth.ok && isSubscriptionToken(auth.apiKey);
}

export default function claudePro(pi: ExtensionAPI): void {
  let version: string | undefined;
  let ctx: ExtensionContext | undefined;

  function show(status: Footer | undefined): void {
    if (!ctx?.hasUI) return;
    ctx.ui.setStatus(
      STATUS_KEY,
      status && ctx.ui.theme.fg(status.level, status.text),
    );
  }

  function showLimits(limits: Limits): void {
    show(footer(limits));
  }

  async function showReady(current: ExtensionContext): Promise<void> {
    ctx = current;
    show((await usesSubscription(current)) ? READY : undefined);
  }

  pi.registerProvider("anthropic", {
    api: "anthropic-messages",
    streamSimple: createProviderStream({
      stream: anthropicMessagesApi().streamSimple,
      claudeCodeVersion: () => (version ??= readClaudeCodeVersion()),
      contextWindows: new Map(
        getBuiltinModels("anthropic").map((model) => [
          model.id,
          model.contextWindow,
        ]),
      ),
      watchRequest: createRateLimits({ fetchUsage, onLimits: showLimits }),
    }),
  });

  pi.on("session_start", (_event, current) => showReady(current));
  pi.on("model_select", (_event, current) => showReady(current));

  pi.on("after_provider_response", async (event, current) => {
    ctx = current;
    if (!(await usesSubscription(current))) return;
    const limits = parseLimitHeaders(event.headers, event.status);
    if (limits) showLimits(limits);
  });

  pi.on("session_shutdown", (_event, current) => {
    ctx = current;
    show(undefined);
    ctx = undefined;
  });
}
