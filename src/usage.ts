import { parseUsageBody, type Limits } from "./limits.ts";
import type { RequestAuth } from "./rate-limit.ts";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

/** Asks Anthropic how much of each subscription limit is spent. */
export async function fetchUsage({
  accessToken,
  headers,
  signal,
}: RequestAuth): Promise<Limits | undefined> {
  const sent = Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  );
  const response = await fetch(USAGE_URL, {
    headers: {
      ...sent,
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "anthropic-beta": "oauth-2025-04-20",
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`usage endpoint returned HTTP ${response.status}`);
  }
  return parseUsageBody(await response.json());
}
