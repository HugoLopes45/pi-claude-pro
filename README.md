# pi-claude-pro

[![CI](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pi-claude-pro)](https://www.npmjs.com/package/pi-claude-pro)
[![Pi package](https://img.shields.io/badge/pi.dev-package-blue)](https://pi.dev/packages/pi-claude-pro)
[![License: MIT](https://img.shields.io/npm/l/pi-claude-pro)](LICENSE)

Use your Claude Pro or Max subscription in [Pi](https://pi.dev), with your usage in the footer and a clear message when a limit is spent.

## What it does

When the Anthropic model uses a subscription token, the extension:

- sends the request with the Claude Code identity: user agent, `x-app` header, session header and billing block;
- moves Pi's documentation section from the system prompt to the start of the first user message;
- uses the full context window from Pi's model catalog;
- shows your 5-hour and weekly usage in the footer;
- replaces the error of a spent limit with a clear message and its reset time, and stops pointless retries.

Requests that use an Anthropic API key are not changed.

### Compatibility with other extensions

The adapter accepts structured Pi prompts and complete text prompts returned by other extensions. It does not require a specific extension configuration.

Only complete `<docs>` blocks starting with `Pi documentation` are moved. Custom documentation, instructions, tools and skills remain unchanged. Unrecognized or fragmented documentation stays in place.

## Requirements

- Pi. CI checks the lockfile baseline and the latest published Pi packages; see the compatibility policy below.
- A Claude Pro or Max subscription.

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) is optional. When `claude` is on the `PATH`, the extension sends its version. Otherwise it sends the bundled version, 2.1.289.

## Install

```bash
pi install npm:pi-claude-pro
```

To try it for one session without installing:

```bash
pi -e npm:pi-claude-pro
```

To update or remove it:

```bash
pi update --extensions
pi remove npm:pi-claude-pro
```

Use only one extension that handles the `anthropic` provider. Remove other Claude subscription extensions before you install this one.

## Set up

1. Start Pi.
2. Run `/login`, then select **Anthropic (Claude Pro/Max)**.
3. Select an Anthropic model with `/model`.

The footer shows **Claude Pro** when the extension is active.

## Footer

| Footer                                           | Meaning                                                        |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `Claude Pro`                                     | Subscription active, no usage data yet.                        |
| `Claude 5h 42% · 7d 10%`                         | Usage of the 5-hour and weekly limits. Warning color from 80%. |
| `Claude extra usage · resets 18:00`              | The subscription limit is spent. Requests use extra usage.     |
| `Claude weekly limit reached · resets Sat 09:30` | The subscription refuses requests until the reset.             |

## Troubleshooting

**`pi-claude-pro cannot run claude --version`**: Claude Code is installed but broken. Repair it, or remove it from the `PATH`.

**`Claude 5-hour limit reached`**: wait for the reset time, or enable extra usage in your Claude account.

**`usage lookup failed`**: Anthropic returned HTTP 429, and the usage endpoint did not answer. Pi retries the request.

**No `Claude Pro` in the footer**: run `/login` again and select **Anthropic (Claude Pro/Max)**, not the API key. Then run `pi list` and check that no other extension handles Claude.

## Risks and limits

- **Unofficial.** Anthropic does not support this package. Using a subscription outside Claude Code can break the Anthropic Consumer Terms. You accept this risk.
- **Server contract.** The request is valid only while Anthropic accepts the Claude Code identity that this package sends: headers, billing block and its checksum. Anthropic does not publish this contract and can change it at any time. The offline tests cannot detect such a change. Run `npm run check:live` to test the current contract.
- **Pi versions.** Host-provided packages use `peerDependencies: "*"`; the extension does not bundle or enforce a specific Pi version. The lockfile gives reproducible baseline tests. CI also installs the latest published Pi packages on Node 24 and reruns all checks, on pull requests and weekly. A passing check establishes compatibility with those versions, not unknown future API changes.

## Development

```bash
npm ci
npm run check
pi -e .
```

The tests run offline. They load the extension in Pi, with Pi retries on, and replace the network with a fake Anthropic server.

The fake server accepts every request, so the offline tests do not prove that Anthropic accepts them. To check that, log in to Pi with your subscription, then run:

```bash
npm run check:live
```

It sends one small request to `claude-haiku-4-5` and fails when Anthropic does not bill it to the subscription.

Report bugs on [GitHub Issues](https://github.com/HugoLopes45/pi-claude-pro/issues).

## Contributing and releases

See [CONTRIBUTING.md](CONTRIBUTING.md) for local checks and pull requests. Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues.

1. Open a pull request. CI runs `npm run check` on Node 22 and 24.
2. Add user-visible changes under `## Unreleased` in `CHANGELOG.md`.
3. Choose `patch` for fixes, `minor` for compatible features, or `major` for breaking changes.
4. Run `npm run release -- <patch|minor|major|x.y.z>` from an up-to-date, clean `main`. This opens a release PR with matching package and lockfile versions, versioned notes, and an empty `Unreleased` section.
5. Merge after CI succeeds. Only a version increase on `main` triggers publication, not dependency or documentation changes alone.

CI checks version progression, matching manifest metadata, and release notes before publication. The release job tests the exact merged commit, publishes through npm OIDC, and creates its GitHub tag and release.

If publication fails, fix the cause and use **Re-run failed jobs** on that run. A retry uses the same commit. An existing npm version or tag must match that commit; mismatches fail instead of overwriting a release. npm can take time to make an accepted publication visible.

The workflow publishes through npm trusted publishing, so the repository stores no npm token. Before the first release, configure the package's npm trusted publisher for this repository, `release.yml`, and the GitHub environment `npm`.

## License

[MIT](LICENSE)
