import type { ProviderHeaders } from "@earendil-works/pi-ai";
import { parseLimitHeaders, parseUsageBody, type Limits } from "./limits.ts";
import { exhaustedMessage } from "./status.ts";

const USAGE_CACHE_MS = 30_000;

export interface RequestAuth {
  accessToken: string;
  headers: ProviderHeaders;
  signal: AbortSignal | undefined;
  modelId: string;
  /** False when the model's base URL is not Anthropic, such as a proxy. */
  firstParty: boolean;
}

export interface RateLimitDeps {
  /** Returns the raw body of the usage endpoint. */
  fetchUsage: (auth: RequestAuth) => Promise<unknown>;
  onLimits: (limits: Limits) => void;
  now?: () => number;
}

/** Watches one request and explains subscription quota errors. */
export interface RequestWatch {
  inspect(response: Response): Promise<Response>;
  explain(errorMessage: string | undefined): string | undefined;
}

async function isExtraUsageExhausted(response: Response): Promise<boolean> {
  return (await response.clone().text()).includes("You're out of extra usage.");
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

    async function lookUp(
      headerLimits: Limits | undefined,
    ): Promise<Limits | undefined> {
      // The usage endpoint does not report extra usage, so it cannot overrule
      // headers that say extra usage covers the request. Behind a proxy, the
      // request headers are meant for the proxy, not for Anthropic.
      if (
        headerLimits?.exhausted ||
        headerLimits?.extraUsage ||
        !auth.firstParty
      )
        return headerLimits;
      try {
        return (await usage(auth)) ?? headerLimits;
      } catch (error) {
        lookupError = error instanceof Error ? error.message : String(error);
        return headerLimits;
      }
    }

    return {
      async inspect(response) {
        limits = undefined;
        lookupError = undefined;
        if (response.status === 400) {
          if (!(await isExtraUsageExhausted(response))) return response;
          limits = {
            exhausted: true,
            extraUsage: false,
            claim: "overage",
            windows: [],
          };
        } else if (response.status === 429) {
          limits = await lookUp(
            parseLimitHeaders(Object.fromEntries(response.headers), 429),
          );
        } else {
          return response;
        }
        if (!limits) return response;
        deps.onLimits(limits);
        if (!limits.exhausted) return response;

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
