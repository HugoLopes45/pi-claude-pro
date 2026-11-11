# Contributing

Small, focused contributions are welcome. Discuss large behavior changes in an issue before implementing them.

## Local checks

Use Node.js 22.19 or later. CI checks Node 22 and 24.

```bash
npm ci
npm run check
```

`npm run check` validates package and lockfile metadata, release notes, TypeScript, cyclomatic complexity (at most 10 per function, `npm run lint`), and the offline tests. Split a function that is too complex; inline `eslint-disable` comments have no effect. The tests use a simulated Anthropic server, not your account.

CI also installs the latest published Pi packages on Node 24 and reruns these checks. It runs weekly, even without repository changes.
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
- Describe user-visible changes under `Unreleased` in `CHANGELOG.md`.
- Never include credentials, account data, or private conversation content in commits, screenshots, or logs.

## Pull requests

Open a branch or fork, then submit a pull request against `main`.

Explain the problem, the minimal fix, and the checks you ran. Keep unrelated changes in separate pull requests.

`main` requires a pull request and successful `Check (Node 22)` and `Check (Node 24)` checks against the current base.
No third-party approval is required, so a solo maintainer can merge after CI succeeds. Force pushes and branch deletion are blocked.

## Releases

Release preparation requires Node 24 or later, npm publish permission through the configured workflow, and an authenticated GitHub CLI.

Do not bump the package version in ordinary contribution pull requests.

Merging a release PR only prepares the version. The PR must update both manifests and include nonempty versioned release notes. CI rejects version rollback.

Only the repository owner can launch **Publish release** from an explicit `vX.Y.Z` tag whose commit belongs to `main`. The owner must also approve the `npm` environment deployment. Pushes and tag creation do not publish.

Retry a failed release from its original Actions run and tag. Do not move any release tag or reuse its version for different code.
If the code needs a fix, open another release PR with a new version instead.

### Release procedure

1. Open a pull request. CI runs `npm run check` on Node 22 and 24.
2. Add user-visible changes under `## Unreleased` in `CHANGELOG.md`.
3. Choose `patch` for fixes, `minor` for compatible features, or `major` for breaking changes.
4. Run `npm run release -- <patch|minor|major|x.y.z>` from an up-to-date, clean `main`. This opens a release PR with matching package and lockfile versions, versioned notes, and an empty `Unreleased` section.
5. Merge the release PR, then wait for CI to succeed on the exact `main` commit you want to publish.
6. Create `vX.Y.Z` at that commit and push that tag. The tag must match the package version. Release tags cannot be moved or deleted.
7. As the repository owner, launch **Publish release** at that tag: `gh workflow run release.yml --ref vX.Y.Z -f tag=vX.Y.Z`.
8. Approve the `npm` environment deployment. The owner can approve their own run; no third-party approval is needed.

Merges, pushes, and tag creation never publish. The manual workflow requires an existing stable-version tag, matching manifests and release notes, and successful CI on its exact commit. That commit must belong to `main`. The dispatch ref and input tag must match. Running from the tag keeps npm provenance tied to the selected commit.

The workflow tests and publishes that commit, not the current tip of `main`, then creates the GitHub release. A new npm publication updates the `latest` dist-tag.

If publication fails, fix the cause and use **Re-run failed jobs** on the original run, with the same tag. An existing npm version must have the same source commit; mismatches fail instead of overwriting a release. For code changes, prepare a new version and tag. npm can take time to make an accepted publication visible.

The workflow uses npm trusted publishing, so the repository stores no npm token. Configure the npm trusted publisher for this repository, `release.yml`, and the GitHub environment `npm`. Restrict that environment to tags `v*`, with the owner as its required reviewer and self-review allowed. The workflow checks that the tagged commit belongs to `main`. Protect `v*` tags from updates and deletion, with no bypass actors. Keep these repository protections enabled to preserve release identity across retries.

## Security

Use the [private reporting process](SECURITY.md) for vulnerabilities. Do not put exploit details or credentials in a public issue.
