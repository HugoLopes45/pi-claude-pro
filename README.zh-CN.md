# pi-claude-pro：在 Pi 中使用你的 Claude Pro、Max 或 Ultra 套餐

[English](README.md) | 简体中文

[![CI](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HugoLopes45/pi-claude-pro/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pi-claude-pro)](https://www.npmjs.com/package/pi-claude-pro)
[![Pi package](https://img.shields.io/badge/pi.dev-package-blue)](https://pi.dev/packages/pi-claude-pro)
[![Node.js](https://img.shields.io/node/v/pi-claude-pro)](https://nodejs.org)
[![License: MIT](https://img.shields.io/npm/l/pi-claude-pro)](LICENSE)

**在 [Pi](https://pi.dev) 编程智能体中使用你已经付费的 Claude 套餐。** 用你的 Claude 账号登录一次，即可在 Pi 中使用 Claude Opus、Sonnet、Haiku 和 Fable。请求计入你的套餐限额，而不是使用 API 密钥。每次请求后，底部状态栏显示你的 5 小时用量和每周用量；当 Anthropic 将某个请求按额外用量（extra usage）计费时，它会提醒你。

```bash
pi install npm:pi-claude-pro
```

不需要 Anthropic API 密钥。不需要安装 Claude Code。没有额外的 npm 依赖：它使用你已经安装的 Pi 包。本包为非官方项目：使用前请阅读[风险与限制](#风险与限制)。

## 为什么选择 pi-claude-pro

- **用套餐代替 API 密钥。** Pro、Max 和 Ultra 套餐包含 Claude 用量，Pi 直接使用这些用量。
- **限额一目了然。** 在限额用完之前，底部状态栏会显示警告颜色。
- **额外用量不会让你措手不及。** 底部状态栏和 `/claude-pro` 会在请求按 token 计费时告诉你，并说明原因。
- **明确停止，而不是反复重试。** 限额用完时，你会看到一条注明限额名称的消息。
- **继续已有的对话线程时，仍计入你的订阅。**
- **新模型无需更新 pi-claude-pro。** 扩展会自动适配 Anthropic 要求的 Claude Code 版本。
- **每个模型的完整上下文窗口。**
- **你的配置保持不变。** 你的指令、工具和技能都保持原样。

## 快速开始

你需要 Pi 1.0.3 或更高版本、Node.js 22.19 或更高版本，以及 Claude Pro、Max 或 Ultra 订阅。

1. 用上面的命令安装本包。
2. 启动 Pi。
3. 运行 `/login`，然后选择 **Anthropic (Claude Pro/Max)**。
4. 用 `/model` 选择一个 Anthropic 模型。

扩展生效时，底部状态栏显示 **Claude plan**。运行 `/claude-pro` 可以查看模型、登录类型和你的用量。

只使用一个处理 `anthropic` 提供商的扩展。请先移除其他 Claude 订阅扩展。

## 底部状态栏中的用量

| 底部状态栏                                       | 含义                                                     |
| ------------------------------------------------ | -------------------------------------------------------- |
| `Claude plan`                                    | 订阅已生效，暂无用量数据。                               |
| `Claude 5h 42% · 7d 10%`                         | 5 小时限额和每周限额的用量。从 80% 起显示警告颜色。      |
| `Claude 7d 10%`                                  | 每周限额的用量，适用于没有 5 小时限额的套餐。            |
| `Claude 5h 42% · 7d 10% · Fable 30%`             | 使用 Fable 时，还显示 Fable 每周限额的用量。             |
| `Claude extra usage · resets 18:00`              | 请求按额外用量计费，按 token 收费。                      |
| `Claude weekly limit reached · resets Sat 09:30` | 在重置之前，订阅会拒绝请求。                             |
| `Claude: /login`                                 | 尚未登录 Anthropic。请运行 `/login`。                   |
| `Claude API key · /claude-pro`                   | Pi 使用的是 API 密钥，而不是你的套餐。                   |
| `Claude login failed · /claude-pro`              | Pi 无法读取或刷新 Claude 登录凭据。                          |

当 Anthropic 将某个请求按额外用量计费时，即使你的套餐限额还没有用完，底部状态栏也会显示出来。之后扩展会在每个会话中提醒一次。

## `/claude-pro` 命令

运行 `/claude-pro` 可以查看当前模型、它的请求是否使用你的套餐，以及每个限额的用量和重置时间。当请求按额外用量计费时，该命令会告诉你可能的原因。

## 工作原理

- 扩展以 Claude Code 的方式发送每个订阅请求：user agent、`x-app` 请求头、会话请求头和计费块。
- Pi 1.5.1 在继续一个消息线程时不带系统提示词。扩展也会为这些请求加上计费块，因此 Anthropic 不会以 HTTP 429 拒绝它们。
- 扩展发送 Claude Code 版本 2.1.322。当某个模型需要更新的版本时，Anthropic 会在错误中给出该版本。扩展会用该版本重试一次，并在本次会话中继续使用它。
- 限额用完时，错误信息会注明限额名称；如果 Anthropic 提供了重置时间，也会一并显示。Pi 不会重试这些请求。临时性的 429 仍然可以重试。
- 扩展会把 Pi 的文档部分从系统提示词移到第一条用户消息的开头。只有以 `Pi documentation` 开头的完整 `<docs>` 块才会被移动。自定义文档、指令、工具和技能都保持原样，包括其他扩展返回的提示词。
- 当系统提示词看起来像第三方应用时，Anthropic 可能将请求按额外用量计费。Pi 的文档部分可能导致这种情况，所以扩展会移动它。
- 使用 Anthropic API 密钥的请求不会被修改。

## 风险与限制

- **非官方。** Anthropic 未认可本包，也不为其提供支持。在 Claude Code 之外使用订阅可能违反 Anthropic 消费者条款（Consumer Terms）。你需要自行承担这一风险。
- **服务器约定。** 只有在 Anthropic 接受本包发送的 Claude Code 身份时，请求才能正常工作。Anthropic 没有公开这一约定，并且可以随时更改。离线测试无法发现这类变化。`npm run check:live` 会测试当前的约定；参见 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。
- **Pi 版本。** 扩展不强制要求特定的 Pi 版本。CI 会在每个 pull request 上以及每周测试 Pi 1.0.3、锁文件基线以及最新发布的 Pi 包。未来的 Pi API 变化仍可能导致它失效。

## 常见问题

**我可以不用 API 密钥，在 Pi 中使用 Claude 订阅吗？** 可以。参见[快速开始](#快速开始)。请求计入你的订阅限额。

**我需要 Claude Code 吗？** 不需要。扩展不会运行或调用 Claude Code。

**它适用于没有 5 小时限额的套餐吗，例如 Ultra？** 适用。当 Anthropic 没有发送 5 小时窗口时，底部状态栏只显示每周限额。

**我可以在 Pi 中使用 Claude Fable 吗？** 可以。在 Max 和 Ultra 套餐中，Fable 计入你的套餐，最多占每周限额的 50%。在 Pro 套餐中，Anthropic 将 Fable 按付费用量额度计费。扩展发送 Claude Code 2.1.322，而 Fable 5.2 需要 2.1.321 或更高版本。使用 Fable 时，底部状态栏还会显示 Fable 每周限额。该限额用完后，切换到其他模型即可继续使用你的套餐。

**为什么 Anthropic 在 Pi 中把我的 Claude 订阅按额外用量计费？** 在以下情况下，Anthropic 会将请求按额外用量计费：套餐限额已用完；该模型在你的套餐中需要用量额度；或者系统提示词看起来像第三方应用。Pi 的文档部分可能导致最后一种情况，所以扩展会把它移出系统提示词。运行 `/claude-pro` 可以查看你的限额和可能的原因。

**如何在 Pi 中查看我的 Claude 用量限额？** 每次请求后，底部状态栏会显示 5 小时用量和每周用量。运行 `/claude-pro` 可以查看每个限额及其重置时间。

**Anthropic 允许这样使用吗？** 本包为非官方项目，可能违反 Anthropic 消费者条款。参见[风险与限制](#风险与限制)。

## 故障排除

**Pi 警告第三方使用会消耗额外用量**：对于每个 Anthropic 订阅登录，Pi 都会显示这个警告。使用本扩展时，请求使用你的订阅限额，并且底部状态栏会在请求按额外用量计费时提示你。要隐藏这个警告，请在 `/settings` 中关闭 Anthropic 额外用量警告。

**限额未用完却显示 `Claude extra usage`**：运行 `/claude-pro`。该模型可能在你的套餐中需要用量额度，例如 Pro 套餐中的 Fable。或者 Anthropic 把请求识别为第三方应用：请移除其他向系统提示词添加文本的扩展，然后重试。

**`claude_code_version_too_old`** 或 **`version X or newer is required`**：使用 Anthropic 指定版本的重试也失败了。请更新 pi-claude-pro。

**`Claude 5-hour limit reached`** 或 **`Claude weekly limit reached`**：等待重置时间，或在你的 Claude 账号中启用额外用量。

**`Claude weekly Fable limit reached`**：切换到其他模型，例如 Opus，或在你的 Claude 账号中启用额外用量。

**`usage lookup failed`**：Anthropic 返回了 HTTP 429，并且用量接口没有响应。Pi 会重试该请求。

**底部状态栏没有 `Claude plan`**：再次运行 `/login`，并选择 **Anthropic (Claude Pro/Max)**，而不是 API 密钥。然后运行 `pi list`，确认没有其他扩展在处理 Claude。

## 更新、试用或移除

```bash
pi update --extensions          # 更新
pi -e npm:pi-claude-pro         # 不安装，只试用一个会话
pi remove npm:pi-claude-pro     # 移除
```

## 参与贡献

关于本地检查、pull request 和发布流程，请参阅 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。请在 [GitHub Issues](https://github.com/HugoLopes45/pi-claude-pro/issues) 报告 bug，并通过 [SECURITY.zh-CN.md](SECURITY.zh-CN.md) 报告安全漏洞。

## 许可证

[MIT](LICENSE)
