import type { Limits } from "./limits.ts";

const WARNING_UTILIZATION = 0.8;
const DAY_MS = 86_400_000;

const CLAIM_LABELS: Record<string, string> = {
  five_hour: "5-hour limit",
  seven_day: "weekly limit",
  seven_day_opus: "weekly Opus limit",
  seven_day_sonnet: "weekly Sonnet limit",
  seven_day_overage_included: "weekly limit",
  overage: "extra usage limit",
};

export interface Footer {
  text: string;
  level: "success" | "warning" | "error";
}

export const READY: Footer = { text: "Claude Pro", level: "success" };

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
