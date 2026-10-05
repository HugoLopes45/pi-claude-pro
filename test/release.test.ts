import { describe, expect, it } from "vitest";
import {
  isPublished,
  nextVersion,
  releaseNotes,
  stampUnreleased,
} from "../scripts/release.ts";

const changelog = `# Changelog

## Unreleased

- New thing.

## 0.2.0

- Settings.
- Early compaction.

## 0.1.0

- First release.
`;

describe("nextVersion", () => {
  it("bumps the requested part", () => {
    expect(nextVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(nextVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(nextVersion("1.2.3", "major")).toBe("2.0.0");
  });

  it("accepts an explicit newer version", () => {
    expect(nextVersion("1.2.3", "1.10.0")).toBe("1.10.0");
  });

  it("rejects an older, equal or malformed version", () => {
    expect(() => nextVersion("1.2.3", "1.2.3")).toThrow("newer than 1.2.3");
    expect(() => nextVersion("1.2.3", "1.1.9")).toThrow("newer than 1.2.3");
    expect(() => nextVersion("1.2.3", "1.3")).toThrow("x.y.z");
    expect(() => nextVersion("1.2.3", "v1.3.0")).toThrow("x.y.z");
  });
});

describe("releaseNotes", () => {
  it("returns the section of that version", () => {
    expect(releaseNotes(changelog, "0.2.0")).toBe(
      "- Settings.\n- Early compaction.",
    );
    expect(releaseNotes(changelog, "0.1.0")).toBe("- First release.");
  });

  it("rejects a missing or empty section", () => {
    expect(() => releaseNotes(changelog, "9.9.9")).toThrow("## 9.9.9");
    expect(() => releaseNotes("## 1.0.0\n\n## 0.9.0\n- x", "1.0.0")).toThrow(
      "## 1.0.0",
    );
  });
});

describe("stampUnreleased", () => {
  it("names the Unreleased section after the version", () => {
    const stamped = stampUnreleased(changelog, "0.3.0");
    expect(stamped).toContain("## 0.3.0\n\n- New thing.");
    expect(stamped).not.toContain("Unreleased");
    expect(releaseNotes(stamped, "0.2.0")).toBe(
      "- Settings.\n- Early compaction.",
    );
  });

  it("rejects a missing or empty Unreleased section", () => {
    expect(() =>
      stampUnreleased("# Changelog\n\n## 0.1.0\n- x", "0.2.0"),
    ).toThrow("## Unreleased");
    expect(() =>
      stampUnreleased("## Unreleased\n\n## 0.1.0\n- x", "0.2.0"),
    ).toThrow("## Unreleased");
  });
});

describe("isPublished", () => {
  const registry =
    (status: number, document: unknown = {}): typeof fetch =>
    async () =>
      new Response(JSON.stringify(document), { status });

  it("reads the versions of the package", async () => {
    const get = registry(200, { versions: { "0.1.0": {} } });
    expect(await isPublished("pi-claude-pro", "0.1.0", get)).toBe(true);
    expect(await isPublished("pi-claude-pro", "0.2.0", get)).toBe(false);
  });

  it("treats an unknown package as unpublished", async () => {
    expect(await isPublished("pi-claude-pro", "0.1.0", registry(404))).toBe(
      false,
    );
  });

  it("fails on other registry errors", async () => {
    await expect(
      isPublished("pi-claude-pro", "0.1.0", registry(503)),
    ).rejects.toThrow("503");
  });
});
