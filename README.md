# pi-claude-pro: use your Claude Pro, Max or Ultra plan in Pi

English | [简体中文](https://github.com/HugoLopes45/pi-claude-pro/blob/main/README.zh-CN.md)

[![CI](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pi-claude-pro)](https://www.npmjs.com/package/pi-claude-pro)
[![Pi package](https://img.shields.io/badge/pi.dev-package-blue)](https://pi.dev/packages/pi-claude-pro)
[![Node.js](https://img.shields.io/node/v/pi-claude-pro)](https://nodejs.org)
[![License: MIT](https://img.shields.io/npm/l/pi-claude-pro)](LICENSE)

**Use the Claude plan you already pay for in the [Pi](https://pi.dev) coding agent.** Log in once with your Claude account and run Claude Opus, Sonnet, Haiku and Fable in Pi. Requests count against your plan limits instead of an API key. The footer shows your 5-hour and weekly usage after each request, and warns you when Anthropic bills a request as extra usage.

```bash
pi install npm:pi-claude-pro
```

No Anthropic API key. No Claude Code install. No extra npm dependencies: it uses the Pi packages you already have. This package is unofficial: read [Risks and limits](#risks-and-limits) before you use it.

## Why pi-claude-pro

- **Your plan instead of an API key.** Pro, Max and Ultra plans include Claude usage. Pi uses that usage.
- **Your limits in view.** A warning color appears before a limit is spent.
- **No surprise extra usage.** The footer and `/claude-pro` tell you when a request is billed per token, and why.
- **A clear stop, not a retry loop.** A spent limit gets a message with the limit name.
- **Continued threads stay on your subscription.**
- **New models without a pi-claude-pro update.** The extension adapts to the Claude Code version that Anthropic requires.
- **The full context window** of each model.
- **Your setup stays intact.** Your instructions, tools and skills stay in place.

## Quick start

You need Pi 1.0.3 or later, Node.js 22.19 or later, and a Claude Pro, Max or Ultra subscription.

1. Install the package with the command above.
2. Start Pi.
3. Run `/login`, then select **Anthropic (Claude Pro/Max)**.
4. Select an Anthropic model with `/model`.

The footer shows **Claude plan** when the extension is active. Run `/claude-pro` to see the model, the login type and your usage.

Use only one extension that handles the `anthropic` provider. Remove other Claude subscription extensions first.

## Your usage in the footer

| Footer                                           | Meaning                                                        |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `Claude plan`                                    | Subscription active, no usage data yet.                        |
| `Claude 5h 42% · 7d 10%`                         | Usage of the 5-hour and weekly limits. Warning color from 80%. |
| `Claude 7d 10%`                                  | Usage of the weekly limit, for plans without a 5-hour limit.   |
| `Claude 5h 42% · 7d 10% · Fable 30%`             | On Fable, also the usage of the weekly Fable limit.            |
| `Claude extra usage · resets 18:00`              | Requests are billed as extra usage, per token.                 |
| `Claude weekly limit reached · resets Sat 09:30` | The subscription refuses requests until the reset.             |
| `Claude: /login`                                 | No Anthropic login. Run `/login`.                              |
| `Claude API key · /claude-pro`                   | Pi uses an API key, not your plan.                             |
| `Claude login failed · /claude-pro`              | Pi cannot read or refresh the Claude login.                    |

When Anthropic bills a request as extra usage, the footer shows it even if your plan limits are not reached. The extension then warns once per session.

## The `/claude-pro` command

Run `/claude-pro` to see the current model, whether its requests use your plan, and the usage of each limit with its reset time. When requests are billed as extra usage, the command tells you the likely cause.

## How it works

- The extension sends each subscription request as Claude Code does: user agent, `x-app` header, session header and billing block.
- Pi 1.5.1 continues a message thread without a system prompt. The extension adds the billing block to these requests too, so Anthropic does not refuse them with HTTP 429.
- The extension sends Claude Code version 2.1.322. When a model requires a newer version, Anthropic names it in the error. The extension retries once with that version and keeps it for the session.
- When a limit is spent, the error names the limit and, if Anthropic sends it, the reset time. Pi does not retry these requests. A temporary 429 stays retryable.
- The extension moves Pi's documentation section from the system prompt to the start of the first user message. Only complete `<docs>` blocks that start with `Pi documentation` are moved. Custom documentation, instructions, tools and skills stay in place, including prompts that other extensions return.
- Anthropic can bill a request as extra usage when the system prompt looks like a third-party app. Pi's documentation section can cause this, so the extension moves it.
- Requests that use an Anthropic API key are not changed.

## Risks and limits

- **Unofficial.** Anthropic does not support this package. Using a subscription outside Claude Code can break the Anthropic Consumer Terms. You accept this risk.
- **Server contract.** Requests work only while Anthropic accepts the Claude Code identity that this package sends. Anthropic does not publish this contract and can change it at any time. The offline tests cannot detect such a change. `npm run check:live` tests the current contract; see [CONTRIBUTING.md](CONTRIBUTING.md).
- **Pi versions.** The extension does not enforce a Pi version. CI tests Pi 1.0.3, the lockfile baseline and the latest published Pi packages, on pull requests and weekly. A future Pi API change can still break it.

## FAQ

**Can I use my Claude subscription in Pi without an API key?** Yes. See [Quick start](#quick-start). Requests count against your subscription limits.

**Do I need Claude Code?** No. The extension does not run or call Claude Code.

**Does it work on a plan without a 5-hour limit, such as Ultra?** Yes. When Anthropic sends no 5-hour window, the footer shows only the weekly limit.

**Can I use Claude Fable in Pi?** Yes. On Max and Ultra, Fable counts against your plan, up to 50% of your weekly limit. On Pro, Anthropic bills Fable as paid usage credits. The extension sends Claude Code 2.1.322, and Fable 5.2 requires 2.1.321 or later. When you use Fable, the footer also shows the weekly Fable limit. When it is spent, switch to another model to continue on your plan.

**Why does Anthropic bill my Claude subscription as extra usage in Pi?** Anthropic bills a request as extra usage when a plan limit is spent, when the model needs usage credits on your plan, or when the system prompt looks like a third-party app. Pi's documentation section can cause the last one, so the extension moves it out of the system prompt. Run `/claude-pro` to see your limits and the likely causes.

**How do I see my Claude usage limits in Pi?** The footer shows the 5-hour and weekly usage after each request. Run `/claude-pro` for each limit with its reset time.

**Is it allowed by Anthropic?** It is unofficial and can break the Anthropic Consumer Terms. See [Risks and limits](#risks-and-limits).

## Troubleshooting

**Pi warns that third-party usage draws from extra usage**: Pi shows this warning for every Anthropic subscription login. With this extension, requests use your subscription limits, and the footer shows when a request is billed as extra usage. To hide the warning, turn off the Anthropic extra usage warning in `/settings`.

**`Claude extra usage` while your limits are not reached**: run `/claude-pro`. The model can need usage credits on your plan, such as Fable on Pro. Or Anthropic classified the request as a third-party app: remove other extensions that add text to the system prompt, then try again.

**`claude_code_version_too_old`** or **`version X or newer is required`**: the retry with the version Anthropic names also failed. Update pi-claude-pro.

**`Claude 5-hour limit reached`** or **`Claude weekly limit reached`**: wait for the reset time, or enable extra usage in your Claude account.

**`Claude weekly Fable limit reached`**: switch to another model, such as Opus, or enable extra usage in your Claude account.

**`usage lookup failed`**: Anthropic returned HTTP 429, and the usage endpoint did not answer. Pi retries the request.

**No `Claude plan` in the footer**: run `/login` again and select **Anthropic (Claude Pro/Max)**, not the API key. Then run `pi list` and check that no other extension handles Claude.

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
