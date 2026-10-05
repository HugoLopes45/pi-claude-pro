import type { ProviderHeaders } from "@earendil-works/pi-ai";
import { parseLimitHeaders, parseUsageBody, type Limits } from "./limits.ts";
import { exhaustedMessage } from "./status.ts";
import { errorText } from "./util.ts";

const USAGE_CACHE_MS = 30_000;

export interface RequestAuth {
  accessToken: string;
  headers: ProviderHeaders;
  signal: AbortSignal | undefined;
  modelId: string;
}

export interface RateLimitDeps {
  /** Returns the raw body of the usage endpoint. */
  fetchUsage: (auth: RequestAuth) => Promise<unknown>;
  onLimits: (limits: Limits) => void;
  now?: () => number;
}

/** Watches the responses of one request and explains its 429 error. */
export interface RequestWatch {
  inspect(response: Response): Promise<Response>;
  explain(errorMessage: string | undefined): string | undefined;
}

export function createRateLimits(
  deps: RateLimitDeps,
): (auth: RequestAuth) => RequestWatch {
  const now = deps.now ?? Date.now;
  let cache: { accessToken: string; at: number; body: unknown } | undefined;

  async function usage(auth: RequestAuth): Promise<Limits | undefined> {
    if (
      cache?.accessToken !== auth.accessToken ||
      now() - cache.at >= USAGE_CACHE_MS
    ) {
      const body = await deps.fetchUsage(auth);
      cache = { accessToken: auth.accessToken, at: now(), body };
    }
    return parseUsageBody(cache.body, auth.modelId);
  }

  return (auth) => {
    let limits: Limits | undefined;
    let lookupError: string | undefined;

    return {
      async inspect(response) {
        limits = undefined;
        lookupError = undefined;
        if (response.status !== 429) return response;

        limits = parseLimitHeaders(Object.fromEntries(response.headers), 429);
        if (!limits?.exhausted) {
          try {
            limits = (await usage(auth)) ?? limits;
          } catch (error) {
            lookupError = errorText(error);
          }
        }
        if (limits) deps.onLimits(limits);
        if (!limits?.exhausted) return response;

        // Retrying a spent subscription only delays the error.
        const headers = new Headers(response.headers);
        headers.set("x-should-retry", "false");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      },

      explain(errorMessage) {
        if (limits?.exhausted) return exhaustedMessage(limits, now());
        if (lookupError)
          return `${errorMessage ?? "HTTP 429"} (usage lookup failed: ${lookupError})`;
        return errorMessage;
      },
    };
  };
}
