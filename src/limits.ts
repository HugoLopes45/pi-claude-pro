import { isRecord } from "./util.ts";

const PREFIX = "anthropic-ratelimit-unified-";
const USAGE_CLAIMS = [
  "five_hour",
  "seven_day",
  "seven_day_opus",
  "seven_day_sonnet",
];
/** Weekly limits that apply only to one model family. */
const MODEL_CLAIMS: Record<string, string> = {
  seven_day_opus: "opus",
  seven_day_sonnet: "sonnet",
};
const WINDOW_NAMES: Record<string, UsageWindow["name"]> = {
  five_hour: "5h",
  seven_day: "7d",
};

export interface UsageWindow {
  name: "5h" | "7d";
  /** Fraction from 0 to 1. */
  utilization: number;
  /** Unix time in seconds. */
  resetsAt?: number;
}

export interface Limits {
  /** The subscription refused the request and extra usage does not cover it. */
  exhausted: boolean;
  /** The subscription is spent and the request is billed as extra usage. */
  extraUsage: boolean;
  claim?: string;
  /** Unix time in seconds. */
  resetsAt?: number;
  windows: UsageWindow[];
}

function finite(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Reads Anthropic's unified rate-limit headers. Returns undefined when absent. */
export function parseLimitHeaders(
  headers: Record<string, string>,
  httpStatus: number,
): Limits | undefined {
  const h = Object.fromEntries(
    Object.entries(headers)
      .filter(([name]) => name.toLowerCase().startsWith(PREFIX))
      .map(([name, value]) => [name.toLowerCase().slice(PREFIX.length), value]),
  );
  if (Object.keys(h).length === 0) return undefined;

  const claim = h["representative-claim"];
  const overage = h["overage-status"];
  const rejected =
    h.status === "rejected" ||
    (h.status === undefined &&
      httpStatus === 429 &&
      (claim !== undefined || overage !== undefined));
  const extraUsage =
    rejected && (overage === "allowed" || overage === "allowed_warning");
  const windows = (["5h", "7d"] as const).flatMap((name): UsageWindow[] => {
    const utilization = finite(h[`${name}-utilization`]);
    return utilization === undefined
      ? []
      : [{ name, utilization, resetsAt: finite(h[`${name}-reset`]) }];
  });
  return {
    exhausted: rejected && !extraUsage,
    extraUsage,
    claim,
    resetsAt: finite(h.reset),
    windows,
  };
}

/**
 * Converts the body of `GET /api/oauth/usage`, where utilization is a
 * percentage. Model-specific limits count only for the model of the request.
 */
export function parseUsageBody(
  body: unknown,
  modelId: string,
): Limits | undefined {
  if (!isRecord(body)) return undefined;
  const model = modelId.toLowerCase();
  const claims = USAGE_CLAIMS.filter((claim) => {
    const family = MODEL_CLAIMS[claim];
    return family === undefined || model.includes(family);
  });
  const entries = claims.flatMap((claim) => {
    const item = body[claim];
    if (!isRecord(item)) return [];
    const { utilization, resets_at, locked_reason } = item;
    if (typeof utilization !== "number" || !Number.isFinite(utilization))
      return [];
    const reset =
      typeof resets_at === "string" ? Date.parse(resets_at) : Number.NaN;
    return [
      {
        claim,
        utilization: utilization / 100,
        resetsAt: Number.isFinite(reset) ? Math.round(reset / 1000) : undefined,
        locked: typeof locked_reason === "string" && locked_reason !== "",
      },
    ];
  });
  if (entries.length === 0) return undefined;

  const spent = entries
    .filter((entry) => entry.utilization >= 1 || entry.locked)
    .sort((a, b) => b.utilization - a.utilization)[0];
  const windows = entries.flatMap((entry): UsageWindow[] => {
    const name = WINDOW_NAMES[entry.claim];
    return name
      ? [{ name, utilization: entry.utilization, resetsAt: entry.resetsAt }]
      : [];
  });
  return {
    exhausted: spent !== undefined,
    extraUsage: false,
    claim: spent?.claim,
    resetsAt: spent?.resetsAt,
    windows,
  };
}
