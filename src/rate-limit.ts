import type { ProviderHeaders } from "@earendil-works/pi-ai";
import { parseLimitHeaders, parseUsageBody, type Limits } from "./limits.ts";
import { exhaustedMessage } from "./status.ts";
import { errorText, isRecord } from "./util.ts";

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

/** Watches one request and explains subscription quota errors. */
export interface RequestWatch {
  inspect(response: Response): Promise<Response>;
  explain(errorMessage: string | undefined): string | undefined;
}

async function isExtraUsageExhausted(response: Response): Promise<boolean> {
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch (error) {
    // Leave non-JSON responses to the provider's normal error handling.
    if (error instanceof SyntaxError) return false;
    throw error;
  }
  return (
    isRecord(body) &&
    body.type === "error" &&
    isRecord(body.error) &&
    body.error.type === "invalid_request_error" &&
    typeof body.error.message === "string" &&
    body.error.message.startsWith("You're out of extra usage.")
  );
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
        if (response.status === 400) {
          if (!(await isExtraUsageExhausted(response))) return response;
          limits = {
            exhausted: true,
            extraUsage: false,
            claim: "overage",
            windows: [],
          };
        } else if (response.status === 429) {
          limits = parseLimitHeaders(Object.fromEntries(response.headers), 429);
          if (!limits?.exhausted) {
            try {
              limits = (await usage(auth)) ?? limits;
            } catch (error) {
              lookupError = errorText(error);
            }
          }
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
