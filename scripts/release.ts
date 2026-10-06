import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isRecord } from "../src/util.ts";

const UNRELEASED = "## Unreleased";

function parse(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Expected a version x.y.z, got "${version}".`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** The version after `current`, from a bump name or an explicit newer version. */
export function nextVersion(current: string, request: string): string {
  const [major, minor, patch] = parse(current);
  if (request === "major") return `${major + 1}.0.0`;
  if (request === "minor") return `${major}.${minor + 1}.0`;
  if (request === "patch") return `${major}.${minor}.${patch + 1}`;
  const next = parse(request);
  const order = next[0] - major || next[1] - minor || next[2] - patch;
  if (order <= 0)
    throw new Error(`Version ${request} must be newer than ${current}.`);
  return request;
}

/** Index range of the body of the `heading` section, or undefined. */
function section(
  changelog: string,
  heading: string,
): { start: number; end: number } | undefined {
  const lines = changelog.split(/\r?\n/);
  const at = lines.indexOf(heading);
  if (at < 0) return undefined;
  const after = lines.slice(at + 1).findIndex((line) => line.startsWith("## "));
  return { start: at + 1, end: after < 0 ? lines.length : at + 1 + after };
}

function body(changelog: string, heading: string): string {
  const range = section(changelog, heading);
  const text = range
    ? changelog.split(/\r?\n/).slice(range.start, range.end).join("\n").trim()
    : "";
  if (!text) throw new Error(`CHANGELOG.md needs entries under "${heading}".`);
  return text;
}

/** The CHANGELOG entries of `version`. */
export function releaseNotes(changelog: string, version: string): string {
  return body(changelog, `## ${version}`);
}

export function stampUnreleased(changelog: string, version: string): string {
  parse(version);
  body(changelog, UNRELEASED);
  if (section(changelog, `## ${version}`))
    throw new Error(`CHANGELOG.md version ${version} already exists.`);
  return changelog.replace(
    /^## Unreleased\r?$/m,
    `${UNRELEASED}\n\n## ${version}`,
  );
}

function packageInfo(value: unknown): { name: string; version: string } {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.version !== "string"
  )
    throw new Error("Invalid package manifest: name and version are required.");
  parse(value.version);
  return { name: value.name, version: value.version };
}

export function validateRelease(
  manifest: unknown,
  lockfile: unknown,
  changelog: string,
): { name: string; version: string } {
  const info = packageInfo(manifest);
  const lock = packageInfo(lockfile);
  if (!isRecord(lockfile) || !isRecord(lockfile.packages))
    throw new Error("package-lock.json is missing root package metadata.");
  const root = packageInfo(lockfile.packages[""]);
  if (
    info.name !== lock.name ||
    info.version !== lock.version ||
    info.name !== root.name ||
    info.version !== root.version
  )
    throw new Error(
      "package.json and package-lock.json must have matching names and versions.",
    );
  releaseNotes(changelog, info.version);
  return info;
}

export function releasePlan(
  previous: unknown,
  manifest: unknown,
  lockfile: unknown,
  changelog: string,
): { version: string; changed: boolean } {
  const { version } = validateRelease(manifest, lockfile, changelog);
  const before = packageInfo(previous).version;
  const changed = version !== before;
  if (changed) nextVersion(before, version);
  return { version, changed };
}

/** Whether npm has `name@version`. Other registry failures throw. */
export async function isPublished(
  name: string,
  version: string,
  expectedCommit: string,
  get: typeof fetch = fetch,
): Promise<boolean> {
  const response = await get(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
  );
  if (response.status === 404) return false;
  if (!response.ok)
    throw new Error(`npm registry answered ${response.status} for ${name}.`);
  const document: unknown = await response.json();
  if (!isRecord(document) || !isRecord(document.versions))
    throw new Error(
      "Invalid npm registry response: expected package versions.",
    );
  if (!Object.hasOwn(document.versions, version)) return false;
  const published = document.versions[version];
  if (!isRecord(published) || published.gitHead !== expectedCommit)
    throw new Error(
      `npm version ${version} belongs to a different or unknown commit.`,
    );
  return true;
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  }).trim();
}

export function publicationTarget(tag: string): {
  version: string;
  commit: string;
} {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
    throw new Error("Expected a release tag vX.Y.Z.");
  const commit = run("git", [
    "rev-parse",
    "--verify",
    `refs/tags/${tag}^{commit}`,
  ]);
  run("git", ["merge-base", "--is-ancestor", commit, "origin/main"]);
  const manifest: unknown = JSON.parse(
    run("git", ["show", `${commit}:package.json`]),
  );
  const lockfile: unknown = JSON.parse(
    run("git", ["show", `${commit}:package-lock.json`]),
  );
  const changelog = run("git", ["show", `${commit}:CHANGELOG.md`]);
  const { version } = validateRelease(manifest, lockfile, changelog);
  if (tag !== `v${version}`)
    throw new Error("Release tag and package version must match.");
  return { version, commit };
}

function prepare(request: string): void {
  if (run("git", ["branch", "--show-current"]) !== "main")
    throw new Error("Run the release from main.");
  if (run("git", ["status", "--porcelain"]))
    throw new Error("Commit or stash your changes first.");
  run("git", ["fetch", "origin", "main"]);
  if (
    run("git", ["rev-parse", "HEAD"]) !==
    run("git", ["rev-parse", "origin/main"])
  )
    throw new Error("Local main differs from origin/main. Pull or push first.");

  const current: unknown = JSON.parse(
    readFileSync("package.json", "utf8"),
  ).version;
  if (typeof current !== "string")
    throw new Error("package.json has no version.");
  const version = nextVersion(current, request);
  const changelog = stampUnreleased(
    readFileSync("CHANGELOG.md", "utf8"),
    version,
  );

  const branch = `release/v${version}`;
  run("git", ["switch", "--create", branch]);
  writeFileSync("CHANGELOG.md", changelog);
  run("npm", ["version", version, "--no-git-tag-version"]);
  execFileSync("npm", ["run", "check"], { stdio: "inherit" });
  run("git", ["add", "package.json", "package-lock.json", "CHANGELOG.md"]);
  run("git", ["commit", "--message", `Release ${version}`]);
  run("git", ["push", "--set-upstream", "origin", branch]);
  const url = run("gh", [
    "pr",
    "create",
    "--base",
    "main",
    "--head",
    branch,
    "--title",
    `Release ${version}`,
    "--body",
    `${releaseNotes(changelog, version)}\n\nMerging only prepares ${version}. The owner must tag the tested main commit and manually run Publish release to publish it.`,
    "--assignee",
    "@me",
  ]);
  console.log(url);
}

function check(base: string | undefined): void {
  const manifest: unknown = JSON.parse(readFileSync("package.json", "utf8"));
  const lockfile: unknown = JSON.parse(
    readFileSync("package-lock.json", "utf8"),
  );
  const changelog = readFileSync("CHANGELOG.md", "utf8");
  if (base === undefined) {
    validateRelease(manifest, lockfile, changelog);
    return;
  }
  if (!/^[a-f0-9]{40}$/.test(base))
    throw new Error("Expected a base commit SHA.");
  const previous: unknown = JSON.parse(
    run("git", ["show", `${base}:package.json`]),
  );
  const plan = releasePlan(previous, manifest, lockfile, changelog);
  console.log(`version=${plan.version}\nchanged=${plan.changed}`);
}

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (rest.some((argument) => argument === ""))
    throw new Error("Release arguments must not be empty.");
  switch (`${command}/${rest.length}`) {
    case "prepare/1":
      return prepare(rest[0]);
    case "notes/1":
      console.log(releaseNotes(readFileSync("CHANGELOG.md", "utf8"), rest[0]));
      return;
    case "published/3":
      console.log(await isPublished(rest[0], rest[1], rest[2]));
      return;
    case "check/0":
    case "check/1":
      return check(rest[0]);
    case "target/1": {
      const target = publicationTarget(rest[0]);
      console.log(`version=${target.version}\ncommit=${target.commit}`);
      return;
    }
  }
  throw new Error(
    "Usage: release.ts prepare <patch|minor|major|x.y.z> | notes <x.y.z> | published <name> <x.y.z> <commit> | check [base-commit] | target <vX.Y.Z>",
  );
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
