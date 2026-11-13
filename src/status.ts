import type { Access } from "./access.ts";
import { MODEL_CLAIMS, type Limits, type UsageWindow } from "./limits.ts";

const WARNING_UTILIZATION = 0.8;
const DAY_MS = 86_400_000;

const CLAIM_LABELS: Record<string, string> = {
  five_hour: "5-hour limit",
  seven_day: "weekly limit",
  seven_day_opus: "weekly Opus limit",
  seven_day_sonnet: "weekly Sonnet limit",
  seven_day_overage_included: "weekly Fable limit",
  overage: "extra usage limit",
};

export interface Footer {
  text: string;
  level: "success" | "warning" | "error";
}

export const READY: Footer = { text: "Claude plan", level: "success" };

const ACCESS_FOOTERS: Record<Access["kind"], Footer | undefined> = {
  subscription: READY,
  "no-login": { text: "Claude: /login", level: "warning" },
  "api-key": { text: "Claude API key · /claude-pro", level: "warning" },
  "auth-error": { text: "Claude login failed · /claude-pro", level: "error" },
  "other-provider": undefined,
};

const WINDOW_LABELS: Record<UsageWindow["name"], string> = {
  "5h": "5-hour limit",
  "7d": "Weekly limit",
  Fable: "Weekly Fable limit",
};

const EXTRA_USAGE_CAUSE =
  "Your plan limits are not reached. The model may need usage credits on your plan, or Anthropic classified the request as a third-party app.";

const LOGIN_HINT =
  'Run /login and select "Anthropic (Claude Pro/Max)". If it is missing, run `pi list` and remove other Claude extensions.';

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local time, with the weekday when the reset is more than a day away. */
export function formatReset(resetsAt: number, now = Date.now()): string {
  const date = new Date(resetsAt * 1000);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (date.getTime() - now < DAY_MS) return time;
  return `${date.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
}

function resetSuffix(resetsAt: number | undefined, now: number): string {
  return resetsAt === undefined
    ? ""
    : ` · resets ${formatReset(resetsAt, now)}`;
}

/** Error text for an exhausted subscription. Avoids words that make Pi retry. */
export function exhaustedMessage(limits: Limits, now = Date.now()): string {
  const label = CLAIM_LABELS[limits.claim ?? ""] ?? "usage limit";
  return `Claude ${label} reached${resetSuffix(limits.resetsAt, now)}`;
}

/** Footer before the first response: how the current model is billed. */
export function accessFooter(kind: Access["kind"]): Footer | undefined {
  return ACCESS_FOOTERS[kind];
}

export interface StatusInput {
  /** Provider and model id, such as `anthropic/claude-opus-5`. */
  model: string;
  kind: Access["kind"];
  /** Why the login failed. */
  error?: string;
  limits?: Limits;
  /** Why the usage lookup failed. */
  usageError?: string;
}

export interface Report {
  level: "info" | "warning" | "error";
  text: string;
}

function inactive(input: StatusInput): Report {
  switch (input.kind) {
    case "other-provider":
      return {
        level: "info",
        text: "pi-claude-pro is inactive: the current model is not a Claude model.\nSelect a Claude model with /model.",
      };
    case "api-key":
      return {
        level: "warning",
        text: `pi-claude-pro is inactive: ${input.model} uses an Anthropic API key, billed per token.\n${LOGIN_HINT}`,
      };
    case "no-login":
      return {
        level: "warning",
        text: `pi-claude-pro is inactive: Anthropic has no login.\n${LOGIN_HINT}`,
      };
    default:
      return {
        level: "error",
        text: `pi-claude-pro is inactive: the Anthropic login failed (${input.error ?? "unknown error"}).\n${LOGIN_HINT}`,
      };
  }
}

/** Extra usage applies although no plan limit is reached. */
function billedWithRoom(limits: Limits): boolean {
  // A per-model weekly claim has no window, so a spent one would look like room.
  if (limits.claim && Object.hasOwn(MODEL_CLAIMS, limits.claim)) return false;
  return (
    (limits.extraUsage || limits.claim === "overage") &&
    limits.windows.length > 0 &&
    limits.windows.every((window) => window.utilization < 1)
  );
}

function usageLines(
  limits: Limits | undefined,
  usageError: string | undefined,
  now: number,
): string[] {
  if (usageError) return [`Usage: unavailable (${usageError})`];
  if (!limits) return ["Usage: shown after the next request"];
  const windows = limits.windows.map(
    (window) =>
      `${WINDOW_LABELS[window.name]}: ${Math.round(window.utilization * 100)}%${resetSuffix(window.resetsAt, now)}`,
  );
  const billing = limits.exhausted
    ? exhaustedMessage(limits, now)
    : limits.extraUsage && "Requests are billed as extra usage, per token.";
  if (!billing) return windows;
  return [
    billing,
    ...(billedWithRoom(limits) ? [EXTRA_USAGE_CAUSE] : []),
    ...windows,
  ];
}

function reportLevel(input: StatusInput, now: number): Report["level"] {
  if (input.usageError) return "warning";
  if (!input.limits) return "info";
  const { level } = footer(input.limits, now);
  return level === "success" ? "info" : level;
}

/** Text of the /claude-pro command. */
export function statusReport(input: StatusInput, now = Date.now()): Report {
  if (input.kind !== "subscription") return inactive(input);
  return {
    level: reportLevel(input, now),
    text: [
      `pi-claude-pro is active: ${input.model} uses your Claude plan.`,
      ...usageLines(input.limits, input.usageError, now),
    ].join("\n"),
  };
}

export function footer(limits: Limits, now = Date.now()): Footer {
  if (limits.exhausted)
    return { text: exhaustedMessage(limits, now), level: "error" };
  if (limits.extraUsage)
    return {
      text: `Claude extra usage${resetSuffix(limits.resetsAt, now)}`,
      level: "warning",
    };
  if (limits.windows.length === 0) return READY;
  const high = limits.windows.some(
    (window) => window.utilization >= WARNING_UTILIZATION,
  );
  const parts = limits.windows.map(
    (window) => `${window.name} ${Math.round(window.utilization * 100)}%`,
  );
  return {
    text: `Claude ${parts.join(" · ")}`,
    level: high ? "warning" : "success",
  };
}
