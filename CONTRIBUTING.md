# Contributing

Small, focused contributions are welcome. Discuss large behavior changes in an issue before implementing them.

## Local checks

Use Node.js 22.19 or later. CI checks Node 22 and 24.

```bash
npm ci
npm run check
```

`npm run check` validates TypeScript, cyclomatic complexity (at most 10 per function, `npm run lint`), and the offline tests. Split a function that is too complex; inline `eslint-disable` comments have no effect. The tests use a simulated Anthropic server, not your account.

CI also installs Pi `1.0.3`, the oldest supported version, and the latest published Pi packages on Node 24, and reruns these checks. It runs weekly, even without repository changes.
Keep the lockfile baseline reproducible; do not replace it with an unbounded dependency tree. Host-provided peer dependencies stay `*`.

For an optional manual test in Pi:

```bash
pi -e .
```

Do not load another copy of this extension in the same session.

`npm run check:live` sends a real request using your Pi login and consumes account usage. Run it only with the account owner's permission.

Offline tests cannot prove that Anthropic accepts subscription requests. State whether a change was tested offline, live, or both.

## Changes

- Keep the extension independent of personal paths, prompts, and other extensions.
- Preserve API-key behavior and unrelated user instructions.
- Prefer existing Pi APIs and small changes over new dependencies or abstractions.
- Add a regression test for a bug and check that it fails before the fix.
- Do not weaken tests or input validation to pass checks.
- Give the pull request a title that describes the user-visible change. Release notes are generated from these titles.
- Never include credentials, account data, or private conversation content in commits, screenshots, or logs.

## Pull requests

Open a branch or fork, then submit a pull request against `main`.

Explain the problem, the minimal fix, and the checks you ran. Keep unrelated changes in separate pull requests.

`main` requires a pull request and successful `Check (Node 22)` and `Check (Node 24)` checks against the current base.
No third-party approval is required, so a solo maintainer can merge after CI succeeds. Force pushes and branch deletion are blocked.

## Releases

Only the repository owner can publish. A GitHub release triggers **Publish release**, and the owner must approve the `npm` environment deployment.

Do not bump the package version in pull requests. The release tag sets the published version.

### Release procedure

1. In a pull request, add a `## [X.Y.Z] - YYYY-MM-DD` entry at the top of `CHANGELOG.md`, in words a user understands. Choose `patch` for fixes, `minor` for compatible features, or `major` for breaking changes. Pi shows this entry to users after `pi update`.
2. Wait for CI to succeed on the `main` commit you want to publish.
3. On GitHub, open **Releases > Draft a new release**.
4. Create the tag `vX.Y.Z` on `main`.
5. Select **Generate release notes**, then **Publish release**.
6. Approve the `npm` environment deployment in the Actions run.

The workflow rejects a release that is not from the owner, a prerelease, a tag that is not `vX.Y.Z`, a commit outside `main`, a commit without successful CI, or a version without a `CHANGELOG.md` entry. It runs `npm run check`, sets the package version from the tag and publishes with npm provenance. A new npm publication updates the `latest` dist-tag.

Releases and `v*` tags are immutable. If publication fails for an external cause, use **Re-run failed jobs** on the original run. If the code needs a fix, publish a new version.

The workflow uses npm trusted publishing, so the repository stores no npm token. Configure the npm trusted publisher for this repository, `release.yml`, and the GitHub environment `npm`. Restrict that environment to tags `v*`, with the owner as its required reviewer and self-review allowed.

## Security

Use the [private reporting process](SECURITY.md) for vulnerabilities. Do not put exploit details or credentials in a public issue.
