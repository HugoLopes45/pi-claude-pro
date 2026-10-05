# pi-claude-pro

[![npm](https://img.shields.io/npm/v/pi-claude-pro)](https://www.npmjs.com/package/pi-claude-pro)
[![Pi package](https://img.shields.io/badge/pi.dev-package-blue)](https://pi.dev/packages/pi-claude-pro)
[![License: MIT](https://img.shields.io/npm/l/pi-claude-pro)](LICENSE)

Use your Claude Pro or Max subscription in [Pi](https://pi.dev).

> **Unofficial.** Anthropic does not support this package. Using a subscription outside Claude Code can break the Anthropic Consumer Terms. Anthropic can change or block this access at any time. You accept this risk.

## What it does

When the Anthropic model uses a subscription token, the extension:

- sends the request with the Claude Code identity: user agent, `x-app` header, session header and billing block;
- removes Pi's documentation section from the system prompt, and gives it back as a hidden message when your prompt mentions Pi;
- uses the full context window from Pi's model catalog;
- shows your 5-hour and weekly usage in the footer;
- replaces the error of a spent limit with a clear message and its reset time, and stops pointless retries.

Requests that use an Anthropic API key are not changed.

## Requirements

- Pi 1.0 or later.
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed. `claude --version` must work in the shell that starts Pi.
- A Claude Pro or Max subscription.

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

**`pi-claude-pro needs Claude Code`**: install Claude Code, then check that `claude --version` works in the same shell.

**`Claude 5-hour limit reached`**: wait for the reset time, or enable extra usage in your Claude account.

**`usage lookup failed`**: Anthropic returned HTTP 429, and the usage endpoint did not answer. Pi retries the request.

**No `Claude Pro` in the footer**: run `/login` again and select **Anthropic (Claude Pro/Max)**, not the API key. Then run `pi list` and check that no other extension handles Claude.

## Development

```bash
npm install
npm run check
pi -e .
```

The tests run offline. They load the extension in Pi and replace the network with a fake Anthropic server.

Report bugs on [GitHub Issues](https://github.com/HugoLopes45/pi-claude-pro/issues).

## License

[MIT](LICENSE)
