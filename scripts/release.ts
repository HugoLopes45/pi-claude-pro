/**
 * Release helper. Run with Node 24 or later.
 *
 *   node scripts/release.ts prepare <patch|minor|major|x.y.z>
 *     Opens a release pull request from an up-to-date, clean main.
 *   node scripts/release.ts notes <x.y.z>
 *     Prints the CHANGELOG section of that version.
 *   node scripts/release.ts published <name> <x.y.z>
 *     Prints whether npm has that version.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

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
  const lines = changelog.split("\n");
  const at = lines.indexOf(heading);
  if (at < 0) return undefined;
  const after = lines.slice(at + 1).findIndex((line) => line.startsWith("## "));
  return { start: at + 1, end: after < 0 ? lines.length : at + 1 + after };
}

function body(changelog: string, heading: string): string {
  const range = section(changelog, heading);
  const text = range
    ? changelog.split("\n").slice(range.start, range.end).join("\n").trim()
    : "";
  if (!text) throw new Error(`CHANGELOG.md needs entries under "${heading}".`);
  return text;
}

/** The CHANGELOG entries of `version`. */
export function releaseNotes(changelog: string, version: string): string {
  return body(changelog, `## ${version}`);
}

/** Renames the Unreleased section to `version`. */
export function stampUnreleased(changelog: string, version: string): string {
  body(changelog, UNRELEASED);
  return changelog.replace(`${UNRELEASED}\n`, `## ${version}\n`);
}

/** Whether npm has `name@version`. Other registry failures throw. */
export async function isPublished(
  name: string,
  version: string,
  get: typeof fetch = fetch,
): Promise<boolean> {
  const response = await get(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
  );
  if (response.status === 404) return false;
  if (!response.ok)
    throw new Error(`npm registry answered ${response.status} for ${name}.`);
  const document: unknown = await response.json();
  const versions =
    typeof document === "object" && document !== null
      ? Reflect.get(document, "versions")
      : undefined;
  return (
    typeof versions === "object" && versions !== null && version in versions
  );
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  }).trim();
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
  run("git", ["commit", "--all", "--message", `Release ${version}`]);
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
    `${releaseNotes(changelog, version)}\n\nMerging publishes ${version} to npm and creates the GitHub release.`,
    "--assignee",
    "@me",
  ]);
  console.log(url);
}

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (command === "prepare" && rest.length === 1 && rest[0]) {
    prepare(rest[0]);
  } else if (command === "notes" && rest.length === 1 && rest[0]) {
    console.log(releaseNotes(readFileSync("CHANGELOG.md", "utf8"), rest[0]));
  } else if (
    command === "published" &&
    rest.length === 2 &&
    rest[0] &&
    rest[1]
  ) {
    console.log(await isPublished(rest[0], rest[1]));
  } else {
    throw new Error(
      "Usage: release.ts prepare <patch|minor|major|x.y.z> | notes <x.y.z> | published <name> <x.y.z>",
    );
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
