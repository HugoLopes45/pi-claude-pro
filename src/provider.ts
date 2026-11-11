import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessageEventStream,
  type Model,
  type SimpleStreamOptions,
  type TranscriptContext,
} from "@earendil-works/pi-ai";
import {
  billingHeader,
  clientHeaders,
  newerVersion,
  requiredVersion,
} from "./claude-code.ts";
import { addThreadBilling, firstUserText, rewriteSystem } from "./payload.ts";
import { movePiDocs } from "./pi-docs.ts";
import type { RequestAuth, RequestWatch } from "./rate-limit.ts";
import { jsonBody } from "./util.ts";

type StreamFn = (
  model: Model<Api>,
  context: TranscriptContext,
  options?: SimpleStreamOptions,
) => AssistantMessageEventStream;

export interface ProviderDeps {
  stream: StreamFn;
  claudeCodeVersion: string;
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

/**
 * Wraps Pi's Anthropic stream so subscription tokens are sent as Claude Code
 * requests. Requests with an API key pass through unchanged.
 */
export function createProviderStream(deps: ProviderDeps): StreamFn {
  // Anthropic names the Claude Code version a model requires, so the bundled
  // version never has to follow new models.
  let learned = "0";
  return (model, context, options) => {
    const accessToken = options?.apiKey;
    if (!accessToken || !isSubscriptionToken(accessToken))
      return deps.stream(model, context, options);

    const version = newerVersion(deps.claudeCodeVersion, learned);

    const headers = clientHeaders(options.headers, version, options.sessionId);
    const firstParty = isFirstParty(model.baseUrl);
    const watch = deps.watchRequest({
      accessToken,
      headers,
      signal: options.signal,
      modelId: model.id,
      firstParty,
    });

    let billing: string | undefined;
    let userText = "";
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
          userText = firstUserText(next);
          billing = billingHeader(version, userText, firstParty);
          return rewriteSystem(next, billing);
        },
        // Error responses never reach onResponse, so quota errors are read here.
        fetch: async (input, init) => {
          const send = (body: RequestInit["body"]) =>
            (options.fetch ?? fetch)(input, { ...init, body });
          const body =
            billing !== undefined && typeof init?.body === "string"
              ? JSON.stringify(addThreadBilling(JSON.parse(init.body), billing))
              : init?.body;
          let response = await send(body);
          const required =
            response.status === 400
              ? requiredVersion(await jsonBody(response))
              : undefined;
          if (required && typeof body === "string") {
            learned = newerVersion(learned, required);
            const retried = billingHeader(required, userText, firstParty);
            await response.body?.cancel();
            // Anthropic checks the billing version, so the user-agent can stay.
            response = await send(
              JSON.stringify(rewriteSystem(JSON.parse(body), retried)),
            );
          }
          return watch.inspect(response);
        },
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
