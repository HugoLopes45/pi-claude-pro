# pi-claude-pro: use your Claude Pro, Max or Ultra plan in Pi

[![CI](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pi-claude-pro)](https://www.npmjs.com/package/pi-claude-pro)
[![Pi package](https://img.shields.io/badge/pi.dev-package-blue)](https://pi.dev/packages/pi-claude-pro)
[![License: MIT](https://img.shields.io/npm/l/pi-claude-pro)](LICENSE)

**Use the Claude plan you already pay for in the [Pi](https://pi.dev) coding agent.** Log in once with your Claude account and run Claude Opus, Sonnet, Haiku and Fable in Pi. Requests count against your plan limits instead of an API key. The footer shows your 5-hour and weekly usage after each request.

```bash
pi install npm:pi-claude-pro
```

No Anthropic API key. No Claude Code install. No extra npm dependencies: it uses the Pi packages you already have. This package is unofficial: read [Risks and limits](#risks-and-limits) before you use it.

## Why pi-claude-pro

- **Your plan instead of an API key.** Pro, Max and Ultra plans include Claude usage. Pi uses that usage.
- **Your limits in view.** A warning color appears before a limit is spent.
- **A clear stop, not a retry loop.** A spent limit gets a message with the limit name.
- **Continued threads stay on your subscription.**
- **New models without a pi-claude-pro update.** The extension adapts to the Claude Code version that Anthropic requires.
- **The full context window** of each model.
- **Your setup stays intact.** Your instructions, tools and skills stay in place.

## Quick start

You need Pi and a Claude Pro, Max or Ultra subscription.

1. Install the package with the command above.
2. Start Pi.
3. Run `/login`, then select **Anthropic (Claude Pro/Max)**.
4. Select an Anthropic model with `/model`.

The footer shows **Claude Pro** on every plan when the extension is active.

Use only one extension that handles the `anthropic` provider. Remove other Claude subscription extensions first.

## Your usage in the footer

| Footer                                           | Meaning                                                        |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `Claude Pro`                                     | Subscription active, no usage data yet.                        |
| `Claude 5h 42% · 7d 10%`                         | Usage of the 5-hour and weekly limits. Warning color from 80%. |
| `Claude 7d 10%`                                  | Usage of the weekly limit, for plans without a 5-hour limit.   |
| `Claude 5h 42% · 7d 10% · Fable 30%`             | On Fable, also the usage of the weekly Fable limit.            |
| `Claude extra usage · resets 18:00`              | The subscription limit is spent. Requests use extra usage.     |
| `Claude weekly limit reached · resets Sat 09:30` | The subscription refuses requests until the reset.             |

## How it works

- The extension sends each subscription request as Claude Code does: user agent, `x-app` header, session header and billing block.
- Pi 1.5.1 continues a message thread without a system prompt. The extension adds the billing block to these requests too, so Anthropic does not refuse them with HTTP 429.
- The extension sends Claude Code version 2.1.322. When a model requires a newer version, Anthropic names it in the error. The extension retries once with that version and keeps it for the session.
- When a limit is spent, the error names the limit and, if Anthropic sends it, the reset time. Pi does not retry these requests. A temporary 429 stays retryable.
- The extension moves Pi's documentation section from the system prompt to the start of the first user message. Only complete `<docs>` blocks that start with `Pi documentation` are moved. Custom documentation, instructions, tools and skills stay in place, including prompts that other extensions return.
- Requests that use an Anthropic API key are not changed.

## Risks and limits

- **Unofficial.** Anthropic does not support this package. Using a subscription outside Claude Code can break the Anthropic Consumer Terms. You accept this risk.
- **Server contract.** Requests work only while Anthropic accepts the Claude Code identity that this package sends. Anthropic does not publish this contract and can change it at any time. The offline tests cannot detect such a change. `npm run check:live` tests the current contract; see [CONTRIBUTING.md](CONTRIBUTING.md).
- **Pi versions.** The extension does not enforce a Pi version. CI tests the lockfile baseline and the latest published Pi packages, on pull requests and weekly. A future Pi API change can still break it.

## FAQ

**Can I use my Claude subscription in Pi without an API key?** Yes. See [Quick start](#quick-start). Requests count against your subscription limits.

**Do I need Claude Code?** No. The extension does not run or call Claude Code.

**Does it work on a plan without a 5-hour limit, such as Ultra?** Yes. When Anthropic sends no 5-hour window, the footer shows only the weekly limit.

**Can I use Claude Fable in Pi?** Yes. On Max and Ultra, Fable counts against your plan, up to 50% of your weekly limit. On Pro, Anthropic bills Fable as paid usage credits. The extension sends Claude Code 2.1.322, and Fable 5.2 requires 2.1.321 or later. When you use Fable, the footer also shows the weekly Fable limit. When it is spent, switch to another model to continue on your plan.

**Is it allowed by Anthropic?** It is unofficial and can break the Anthropic Consumer Terms. See [Risks and limits](#risks-and-limits).

## Troubleshooting

**Pi warns that third-party usage draws from extra usage**: Pi shows this warning for every Anthropic subscription login. With this extension, requests use your subscription limits until a limit is spent, and the footer shows when extra usage starts. To hide the warning, turn it off in `/settings`.

**`claude_code_version_too_old`** or **`version X or newer is required`**: the retry with the version Anthropic names also failed. Update pi-claude-pro.

**`Claude 5-hour limit reached`** or **`Claude weekly limit reached`**: wait for the reset time, or enable extra usage in your Claude account.

**`Claude weekly Fable limit reached`**: switch to another model, such as Opus, or enable extra usage in your Claude account.

**`usage lookup failed`**: Anthropic returned HTTP 429, and the usage endpoint did not answer. Pi retries the request.

**No `Claude Pro` in the footer**: run `/login` again and select **Anthropic (Claude Pro/Max)**, not the API key. Then run `pi list` and check that no other extension handles Claude.

## Update, try or remove

```bash
pi update --extensions          # update
pi -e npm:pi-claude-pro         # try for one session without installing
pi remove npm:pi-claude-pro     # remove
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local checks, pull requests and releases. Report bugs on [GitHub Issues](https://github.com/HugoLopes45/pi-claude-pro/issues), and vulnerabilities through [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
