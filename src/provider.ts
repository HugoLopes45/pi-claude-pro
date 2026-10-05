import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Model,
  type SimpleStreamOptions,
  type TranscriptContext,
} from "@earendil-works/pi-ai";
import { billingHeader, clientHeaders } from "./claude-code.ts";
import { firstUserText, rewriteSystem } from "./payload.ts";
import { movePiDocs } from "./pi-docs.ts";
import type { RequestAuth, RequestWatch } from "./rate-limit.ts";
import { errorText } from "./util.ts";

type StreamFn = (
  model: Model<Api>,
  context: TranscriptContext,
  options?: SimpleStreamOptions,
) => AssistantMessageEventStream;

export interface ProviderDeps {
  stream: StreamFn;
  claudeCodeVersion: () => string;
  /** Full context windows from Pi's model catalog, keyed by model id. */
  contextWindows: ReadonlyMap<string, number>;
  watchRequest: (auth: RequestAuth) => RequestWatch;
}

export function isSubscriptionToken(apiKey: string | undefined): boolean {
  return apiKey?.includes("sk-ant-oat") ?? false;
}

function isFirstParty(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === "api.anthropic.com";
  } catch {
    return false;
  }
}

function failedStream(
  model: Model<Api>,
  error: unknown,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const message: AssistantMessage = {
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
    stopReason: "error",
    errorMessage: errorText(error),
    timestamp: Date.now(),
  };
  stream.push({ type: "error", reason: "error", error: message });
  return stream;
}

/**
 * Wraps Pi's Anthropic stream so subscription tokens are sent as Claude Code
 * requests. Requests with an API key pass through unchanged.
 */
export function createProviderStream(deps: ProviderDeps): StreamFn {
  return (model, context, options) => {
    const accessToken = options?.apiKey;
    if (!accessToken || !isSubscriptionToken(accessToken))
      return deps.stream(model, context, options);

    let version: string;
    try {
      version = deps.claudeCodeVersion();
    } catch (error) {
      return failedStream(model, error);
    }

    const headers = clientHeaders(options.headers, version, options.sessionId);
    const firstParty = isFirstParty(model.baseUrl);
    const watch = deps.watchRequest({
      accessToken,
      headers,
      signal: options.signal,
      modelId: model.id,
    });

    const inner = deps.stream(
      {
        ...model,
        contextWindow: deps.contextWindows.get(model.id) ?? model.contextWindow,
      },
      movePiDocs(context),
      {
        ...options,
        headers,
        onPayload: async (payload, payloadModel) => {
          const next =
            (await options.onPayload?.(payload, payloadModel)) ?? payload;
          const billing = billingHeader(
            version,
            firstUserText(next),
            firstParty,
          );
          return rewriteSystem(next, billing);
        },
        // Error responses never reach onResponse, so 429s are read here.
        fetch: async (input, init) =>
          watch.inspect(await (options.fetch ?? fetch)(input, init)),
      },
    );

    const outer = createAssistantMessageEventStream();
    void (async () => {
      for await (const event of inner) {
        if (event.type === "error" && event.reason === "error")
          event.error.errorMessage = watch.explain(event.error.errorMessage);
        outer.push(event);
      }
      outer.end();
    })();
    return outer;
  };
}
