# Changelog

## Unreleased

- Add CI on Node 22 and 24, release pull-request tooling, and npm trusted-publishing automation.
- Recognize Anthropic's HTTP 400 extra-usage exhaustion response without consuming its body or retrying the rejected request.
- Handle Pi documentation in both structured system prompts and text prompts replaced by other extensions, without configuration-specific hooks.
- Preserve custom documentation sections, instructions, tool declarations and text-block metadata. Leave unrecognized or fragmented documentation unchanged.
- Test replacement prompts across multiple turns and keep API-key requests unchanged.

## 1.1.0

- Claude Code is optional. Without it, the extension uses the bundled Claude Code version 2.1.289.
- Move Pi's documentation section from the system prompt to the first user message of every request. This replaces the keyword match on "pi", which missed questions about the agent and matched unrelated text.
- Cache the usage lookup per access token, so a new login never sees the usage of the previous one.
- Count a spent Opus or Sonnet weekly limit only for requests to that model.
- Run the offline tests with Pi retries on, and prove that a transient 429 is retried and a spent limit is not.
- Add `npm run check:live`, which sends one real request and checks that Anthropic bills it to the subscription.

## 1.0.1

- Set the package author to HugoLopes45.

## 1.0.0

- Send Claude Pro and Max subscription requests from Pi as Claude Code requests.
- Read the Claude Code version from `claude --version`.
- Remove Pi's documentation section from the system prompt. Send it as a hidden message when the user asks about Pi.
- Use the full catalog context window for Anthropic models.
- Show subscription usage in the footer.
- Explain a spent subscription limit with its reset time, and stop Pi from retrying it.
