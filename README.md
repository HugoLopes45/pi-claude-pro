# pi-claude-pro

[![CI](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pi-claude-pro)](https://www.npmjs.com/package/pi-claude-pro)
[![Pi package](https://img.shields.io/badge/pi.dev-package-blue)](https://pi.dev/packages/pi-claude-pro)
[![License: MIT](https://img.shields.io/npm/l/pi-claude-pro)](LICENSE)

Use your Claude Pro or Max subscription in [Pi](https://pi.dev) instead of an Anthropic API key. Pi shows your 5-hour and weekly usage in the footer, and tells you when a limit is spent and when it resets.

This package is unofficial. Read [Risks and limits](#risks-and-limits) before you use it.

## Install

You need:

- Pi. CI checks the lockfile baseline and the latest published Pi packages. See [Risks and limits](#risks-and-limits).
- A Claude Pro or Max subscription.

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) is optional. When `claude` is on the `PATH`, the extension sends its version when it is newer than the bundled version, 2.1.322. Otherwise it sends the bundled version. When a model requires a newer version, Anthropic names it, and the extension retries once with that version and keeps it for the session.

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

## Footer

| Footer                                           | Meaning                                                        |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `Claude Pro`                                     | Subscription active, no usage data yet.                        |
| `Claude 5h 42% · 7d 10%`                         | Usage of the 5-hour and weekly limits. Warning color from 80%. |
| `Claude extra usage · resets 18:00`              | The subscription limit is spent. Requests use extra usage.     |
| `Claude weekly limit reached · resets Sat 09:30` | The subscription refuses requests until the reset.             |

## Troubleshooting

**`pi-claude-pro cannot run claude --version`**: Claude Code is installed but broken. The message ends with the cause. Repair it, or remove it from the `PATH`.

**`claude_code_version_too_old`** or **`version X or newer is required`**: the retry with the version Anthropic names also failed. Run `claude update`, or update pi-claude-pro.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for local checks, pull requests and releases. Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues.

## License

[MIT](LICENSE)
