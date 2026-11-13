import type { Api, Model, ProviderHeaders } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { isFirstParty, isSubscriptionToken } from "./provider.ts";

export type AuthSource = Pick<
  ModelRegistry,
  "hasConfiguredAuth" | "getApiKeyAndHeaders"
>;

export type Access =
  | {
      kind: "subscription";
      accessToken: string;
      headers: ProviderHeaders;
      /** False behind a proxy: the headers are meant for the proxy. */
      firstParty: boolean;
    }
  | { kind: "auth-error"; error: string }
  | { kind: "api-key" | "no-login" | "other-provider" };

/** Tells whether requests to the model go through the Claude plan. */
export async function checkAccess(
  auth: AuthSource,
  model: Model<Api> | undefined,
): Promise<Access> {
  if (model?.provider !== "anthropic") return { kind: "other-provider" };
  const resolved = await auth.getApiKeyAndHeaders(model);
  if (!resolved.ok)
    return auth.hasConfiguredAuth(model)
      ? { kind: "auth-error", error: resolved.error }
      : { kind: "no-login" };
  const { apiKey } = resolved;
  if (!apiKey) return { kind: "no-login" };
  // The provider decides by token too, so status and requests agree.
  if (isSubscriptionToken(apiKey))
    return {
      kind: "subscription",
      accessToken: apiKey,
      headers: resolved.headers ?? {},
      firstParty: isFirstParty(resolved.baseUrl ?? model.baseUrl),
    };
  return { kind: "api-key" };
}
