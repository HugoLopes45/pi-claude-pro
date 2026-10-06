# Contributing

Small, focused contributions are welcome. Discuss large behavior changes in an issue before implementing them.

## Local checks

Use Node.js 22.19 or later. CI checks Node 22 and 24.

```bash
npm ci
npm run check
```

`npm run check` validates package and lockfile metadata, release notes, TypeScript, and the offline tests. The tests use a simulated Anthropic server, not your account.

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

Follow the [release procedure](README.md#contributing-and-releases). Do not bump the package version in ordinary contribution pull requests.

Merging a release PR only prepares the version. The PR must update both manifests and include nonempty versioned release notes. CI rejects version rollback.

Only the repository owner can launch **Publish release** from an explicit `vX.Y.Z` tag whose commit belongs to `main`. The owner must also approve the `npm` environment deployment. Pushes and tag creation do not publish.

Retry a failed release from its original Actions run and tag. Do not move any release tag or reuse its version for different code.
If the code needs a fix, open another release PR with a new version instead.

## Security

Use the [private reporting process](SECURITY.md) for vulnerabilities. Do not put exploit details or credentials in a public issue.
