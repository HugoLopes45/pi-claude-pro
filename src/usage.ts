import type { RequestAuth } from "./rate-limit.ts";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const TIMEOUT_MS = 10_000;

/** Asks Anthropic how much of each subscription limit is spent. */
export async function fetchUsage({
  accessToken,
  headers,
  signal,
}: RequestAuth): Promise<unknown> {
  const sent = Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  );
  const request = new Headers(sent);
  request.set("accept", "application/json");
  request.set("authorization", `Bearer ${accessToken}`);
  request.set("anthropic-beta", "oauth-2025-04-20");
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(USAGE_URL, {
    headers: request,
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
  });
  if (!response.ok) {
    throw new Error(`usage endpoint returned HTTP ${response.status}`);
  }
  return response.json();
}
