import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  billingHeader,
  BUNDLED_CLAUDE_CODE_VERSION,
  clientHeaders,
  readClaudeCodeVersion,
} from "../src/claude-code.ts";

const VERSION = "2.1.289";

describe("billingHeader", () => {
  it("signs the version with characters 4, 7 and 20 of the first user message", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const suffix = createHash("sha256")
      .update("59cf53e54c78" + "ehu" + "2.1.289")
      .digest("hex")
      .slice(0, 3);
    expect(billingHeader(VERSION, text, true)).toBe(
      `x-anthropic-billing-header: cc_version=2.1.289.${suffix}; cc_entrypoint=pi; cch=00000;`,
    );
  });

  it("uses 0 for missing characters", () => {
    const suffix = createHash("sha256")
      .update("59cf53e54c78" + "000" + "2.1.289")
      .digest("hex")
      .slice(0, 3);
    expect(billingHeader(VERSION, "hi", true)).toContain(
      `cc_version=2.1.289.${suffix};`,
    );
  });

  it("omits cch for other hosts", () => {
    expect(billingHeader(VERSION, "", false)).not.toContain("cch=");
  });
});

describe("clientHeaders", () => {
  it("replaces identity headers whatever their case and keeps the others", () => {
    const headers = clientHeaders(
      { "User-Agent": "pi", "X-App": "pi", "x-custom": "1" },
      VERSION,
      "session-1",
    );
    expect(headers).toEqual({
      "x-custom": "1",
      "user-agent": "claude-cli/2.1.289 (external, pi)",
      "x-app": "cli",
      "x-claude-code-session-id": "session-1",
    });
  });
});

describe("readClaudeCodeVersion", () => {
  const path = process.env.PATH;
  afterEach(() => {
    process.env.PATH = path;
  });

  function pathWithClaude(script?: string): string {
    const bin = mkdtempSync(join(tmpdir(), "pi-claude-pro-bin-"));
    if (script !== undefined) {
      const claude = join(bin, "claude");
      writeFileSync(claude, `#!/bin/sh\n${script}\n`);
      chmodSync(claude, 0o755);
    }
    return bin;
  }

  it("uses the installed Claude Code version", () => {
    process.env.PATH = pathWithClaude("echo '9.8.765 (Claude Code)'");
    expect(readClaudeCodeVersion()).toBe("9.8.765");
  });

  it("uses the bundled version when Claude Code is not installed", () => {
    process.env.PATH = pathWithClaude();
    expect(readClaudeCodeVersion()).toBe(BUNDLED_CLAUDE_CODE_VERSION);
  });

  it("fails when an installed Claude Code prints no version", () => {
    process.env.PATH = pathWithClaude("echo 'not a version'");
    expect(() => readClaudeCodeVersion()).toThrow(
      'cannot read the Claude Code version from "not a version"',
    );
  });
});
