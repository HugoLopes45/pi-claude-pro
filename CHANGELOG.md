# Changelog

## 1.0.1

- Set the package author to HugoLopes45.

## 1.0.0

- Send Claude Pro and Max subscription requests from Pi as Claude Code requests.
- Read the Claude Code version from `claude --version`.
- Remove Pi's documentation section from the system prompt. Send it as a hidden message when the user asks about Pi.
- Use the full catalog context window for Anthropic models.
- Show subscription usage in the footer.
- Explain a spent subscription limit with its reset time, and stop Pi from retrying it.
