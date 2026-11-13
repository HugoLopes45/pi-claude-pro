import { anthropicMessagesApi } from "@earendil-works/pi-ai/compat";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { checkAccess, type Access } from "../src/access.ts";
import {
  BUNDLED_CLAUDE_CODE_VERSION,
  clientHeaders,
} from "../src/claude-code.ts";
import {
  parseLimitHeaders,
  parseUsageBody,
  type Limits,
} from "../src/limits.ts";
import { createProviderStream } from "../src/provider.ts";
import { createRateLimits } from "../src/rate-limit.ts";
import {
  accessFooter,
  footer,
  statusReport,
  type Footer,
  type StatusInput,
} from "../src/status.ts";
import { fetchUsage } from "../src/usage.ts";

const STATUS_KEY = "claude-pro";

function access(ctx: ExtensionContext): Promise<Access> {
  return checkAccess(ctx.modelRegistry, ctx.model);
}

async function lookUpUsage(
  auth: Extract<Access, { kind: "subscription" }>,
  modelId: string,
): Promise<Pick<StatusInput, "limits" | "usageError">> {
  try {
    const body = await fetchUsage({
      accessToken: auth.accessToken,
      headers: clientHeaders(
        auth.headers,
        BUNDLED_CLAUDE_CODE_VERSION,
        undefined,
      ),
      signal: undefined,
      modelId,
      firstParty: auth.firstParty,
    });
    return { limits: parseUsageBody(body, modelId) };
  } catch (error) {
    return {
      usageError: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Header limits know the billing state; the usage endpoint fills missing windows. */
async function planUsage(
  auth: Extract<Access, { kind: "subscription" }>,
  modelId: string,
  last: Limits | undefined,
): Promise<Pick<StatusInput, "limits" | "usageError">> {
  if (last && last.windows.length > 0) return { limits: last };
  const usage = auth.firstParty
    ? await lookUpUsage(auth, modelId)
    : { usageError: "not available behind a proxy" };
  if (!last) return usage;
  return {
    limits: { ...last, windows: usage.limits?.windows ?? [] },
    ...(usage.usageError && { usageError: usage.usageError }),
  };
}

export default function claudePro(pi: ExtensionAPI): void {
  let ctx: ExtensionContext | undefined;
  let lastLimits: Limits | undefined;
  let warnedExtraUsage = false;

  function show(status: Footer | undefined): void {
    if (!ctx?.hasUI) return;
    ctx.ui.setStatus(
      STATUS_KEY,
      status && ctx.ui.theme.fg(status.level, status.text),
    );
  }

  function showLimits(limits: Limits): void {
    lastLimits = limits;
    show(footer(limits));
    if (!limits.extraUsage || warnedExtraUsage || !ctx?.hasUI) return;
    warnedExtraUsage = true;
    ctx.ui.notify(
      "Claude requests are billed as extra usage, per token. Run /claude-pro to see why.",
      "warning",
    );
  }

  async function showReady(current: ExtensionContext): Promise<void> {
    ctx = current;
    lastLimits = undefined;
    show(accessFooter((await access(current)).kind));
  }

  async function report(current: ExtensionContext): Promise<void> {
    ctx = current;
    const model = current.model;
    const auth = await access(current);
    const input: StatusInput = {
      model: model ? `${model.provider}/${model.id}` : "none",
      kind: auth.kind,
      ...(auth.kind === "auth-error" && { error: auth.error }),
      ...(auth.kind === "subscription" &&
        model &&
        (await planUsage(auth, model.id, lastLimits))),
    };
    const { text, level } = statusReport(input);
    current.ui.notify(text, level);
  }

  pi.registerProvider("anthropic", {
    api: "anthropic-messages",
    streamSimple: createProviderStream({
      stream: anthropicMessagesApi().streamSimple,
      contextWindows: new Map(
        getBuiltinModels("anthropic").map((model) => [
          model.id,
          model.contextWindow,
        ]),
      ),
      watchRequest: createRateLimits({ fetchUsage, onLimits: showLimits }),
    }),
  });

  pi.registerCommand("claude-pro", {
    description: "Show whether Claude requests use your plan, and your usage",
    handler: (_args, current) => report(current),
  });

  pi.on("session_start", (_event, current) => {
    warnedExtraUsage = false;
    return showReady(current);
  });
  pi.on("model_select", (_event, current) => showReady(current));

  pi.on("after_provider_response", async (event, current) => {
    ctx = current;
    const limits = parseLimitHeaders(event.headers, event.status);
    if (!limits || (await access(current)).kind !== "subscription") return;
    showLimits(limits);
  });

  pi.on("session_shutdown", (_event, current) => {
    ctx = current;
    show(undefined);
    ctx = undefined;
  });
}
