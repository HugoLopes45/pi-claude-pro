import { describe, expect, it } from "vitest";
import {
  isPublished,
  nextVersion,
  releaseNotes,
  stampUnreleased,
  validateRelease,
  releasePlan,
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
    expect(stamped).toContain("## Unreleased\n\n## 0.3.0");
    expect(releaseNotes(stamped, "0.2.0")).toBe(
      "- Settings.\n- Early compaction.",
    );
  });

  it("rejects stamping an already documented version", () => {
    expect(() => stampUnreleased(changelog, "0.2.0")).toThrow("already exists");
  });

  it("keeps the next Unreleased section with CRLF input", () => {
    const stamped = stampUnreleased(
      changelog.replaceAll("\n", "\r\n"),
      "0.3.0",
    );
    expect(releaseNotes(stamped, "0.3.0")).toBe("- New thing.");
    expect(stamped).toMatch(/## Unreleased\r?\n\r?\n## 0.3.0/);
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

const manifest = { name: "pi-claude-pro", version: "0.2.0" };
const lockfile = { ...manifest, packages: { "": manifest } };

describe("validateRelease", () => {
  it("accepts matching manifests and release notes", () => {
    expect(validateRelease(manifest, lockfile, changelog)).toEqual(manifest);
  });

  it.each([
    { ...lockfile, version: "0.1.0" },
    { ...lockfile, packages: { "": { ...manifest, version: "0.1.0" } } },
    { ...lockfile, name: "another-package" },
    { ...lockfile, packages: { "": { ...manifest, name: "another-package" } } },
  ])("rejects inconsistent lockfile metadata: %j", (lock) => {
    expect(() => validateRelease(manifest, lock, changelog)).toThrow(
      "package-lock.json",
    );
  });

  it("rejects missing notes before publication", () => {
    expect(() => validateRelease(manifest, lockfile, "# Changelog")).toThrow(
      "## 0.2.0",
    );
  });

  it.each([null, {}, { version: 2 }, { name: "pi", version: "0.2" }])(
    "rejects malformed manifests: %j",
    (value) => {
      expect(() => validateRelease(value, lockfile, changelog)).toThrow(
        /manifest|version/,
      );
    },
  );
});

describe("releasePlan", () => {
  it("does not publish dependency or documentation changes without a version bump", () => {
    expect(
      releasePlan(
        manifest,
        { ...manifest, dependencies: { changed: "*" } },
        lockfile,
        changelog,
      ),
    ).toEqual({ version: "0.2.0", changed: false });
  });

  it("plans a release only for an increased validated version", () => {
    expect(
      releasePlan(
        { ...manifest, version: "0.1.0" },
        manifest,
        lockfile,
        changelog,
      ),
    ).toEqual({ version: "0.2.0", changed: true });
  });

  it("rejects version rollback", () => {
    expect(() =>
      releasePlan(
        { ...manifest, version: "0.3.0" },
        manifest,
        lockfile,
        changelog,
      ),
    ).toThrow("newer than");
  });
});

describe("isPublished", () => {
  const registry =
    (status: number, document: unknown = {}): typeof fetch =>
    async () =>
      new Response(JSON.stringify(document), { status });

  it("reads the versions of the package", async () => {
    const get = registry(200, {
      versions: { "0.1.0": { gitHead: "expected" } },
    });
    expect(await isPublished("pi-claude-pro", "0.1.0", "expected", get)).toBe(
      true,
    );
    expect(await isPublished("pi-claude-pro", "0.2.0", "expected", get)).toBe(
      false,
    );
  });

  it.each(["other", undefined])(
    "refuses an existing version with a different or missing commit: %s",
    async (gitHead) => {
      await expect(
        isPublished(
          "pi-claude-pro",
          "0.1.0",
          "expected",
          registry(200, { versions: { "0.1.0": { gitHead } } }),
        ),
      ).rejects.toThrow("commit");
    },
  );

  it("treats an unknown package as unpublished", async () => {
    expect(
      await isPublished("pi-claude-pro", "0.1.0", "expected", registry(404)),
    ).toBe(false);
  });

  it.each([null, {}, { versions: [] }, { versions: null }])(
    "rejects malformed registry data instead of attempting publication: %j",
    async (document) => {
      await expect(
        isPublished(
          "pi-claude-pro",
          "0.1.0",
          "expected",
          registry(200, document),
        ),
      ).rejects.toThrow("Invalid npm registry response");
    },
  );

  it("fails on other registry errors", async () => {
    await expect(
      isPublished("pi-claude-pro", "0.1.0", "expected", registry(503)),
    ).rejects.toThrow("503");
  });
});
