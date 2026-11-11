import { createHash } from "node:crypto";
import type { ProviderHeaders } from "@earendil-works/pi-ai";
import { isRecord } from "./util.ts";

// Anthropic validates the 3-character suffix of `cc_version` against this salt.
const BILLING_SALT = "59cf53e54c78";
const SAMPLED_INDEXES = [4, 7, 20];
const ENTRYPOINT = "pi";
/** The version sent until a model requires a newer one. */
export const BUNDLED_CLAUDE_CODE_VERSION = "2.1.322";
const REPLACED_HEADERS = new Set([
  "user-agent",
  "x-app",
  "x-claude-code-session-id",
]);

export function newerVersion(a: string, b: string): string {
  return a.localeCompare(b, "en", { numeric: true }) > 0 ? a : b;
}

/** The version named by a `claude_code_version_too_old` error body. */
export function requiredVersion(body: unknown): string | undefined {
  if (!isRecord(body) || !isRecord(body.error)) return undefined;
  const { details, message } = body.error;
  if (!isRecord(details) || typeof message !== "string") return undefined;
  if (details.error_code !== "claude_code_version_too_old") return undefined;
  return /version (\d+(?:\.\d+)+) or newer is required/.exec(message)?.[1];
}

export function billingHeader(
  version: string,
  firstUserText: string,
  firstParty: boolean,
): string {
  const sample = SAMPLED_INDEXES.map((i) => firstUserText[i] ?? "0").join("");
  const suffix = createHash("sha256")
    .update(BILLING_SALT + sample + version)
    .digest("hex")
    .slice(0, 3);
  const fields = [
    `cc_version=${version}.${suffix}`,
    `cc_entrypoint=${ENTRYPOINT}`,
    ...(firstParty ? ["cch=00000"] : []),
  ];
  return `x-anthropic-billing-header: ${fields.map((f) => `${f};`).join(" ")}`;
}

export function clientHeaders(
  base: ProviderHeaders | undefined,
  version: string,
  sessionId: string | undefined,
): ProviderHeaders {
  const kept = Object.entries(base ?? {}).filter(
    ([name]) => !REPLACED_HEADERS.has(name.toLowerCase()),
  );
  return {
    ...Object.fromEntries(kept),
    "user-agent": `claude-cli/${version} (external, ${ENTRYPOINT})`,
    "x-app": "cli",
    ...(sessionId ? { "x-claude-code-session-id": sessionId } : {}),
  };
}
