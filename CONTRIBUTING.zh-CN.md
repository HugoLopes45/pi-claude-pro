# 参与贡献

[English](CONTRIBUTING.md) | 简体中文

欢迎小而专注的贡献。较大的行为变更，请先在 issue 中讨论，再动手实现。

## 本地检查

使用 Node.js 22.19 或更高版本。CI 会检查 Node 22 和 24。

```bash
npm ci
npm run check
```

`npm run check` 会检查 TypeScript、圈复杂度（每个函数最多 10，`npm run lint`）以及离线测试。函数过于复杂时，请拆分它；行内 `eslint-disable` 注释不起作用。测试使用模拟的 Anthropic 服务器，而不是你的账号。

CI 还会在 Node 24 上安装最早支持的 Pi `1.0.3` 和最新发布的 Pi 包，并重新运行这些检查。即使仓库没有变更，CI 也会每周运行一次。
保持锁文件基线可复现；不要用不受约束的依赖树替换它。由宿主提供的 peer 依赖保持为 `*`。

可选：在 Pi 中手动测试：

```bash
pi -e .
```

不要在同一个会话中加载本扩展的另一个副本。

`npm run check:live` 会使用你的 Pi 登录发送一个真实请求，并消耗账号用量。只有在账号所有者允许时才能运行。

离线测试无法证明 Anthropic 会接受订阅请求。请说明一个变更是经过离线测试、真实账号在线测试（live），还是两者都有。

## 变更要求

- 让扩展不依赖个人路径、提示词和其他扩展。
- 保留 API 密钥的行为和无关的用户指令。
- 优先使用现有的 Pi API 和小改动，而不是新的依赖或抽象。
- 修复 bug 时添加回归测试，并确认它在修复前会失败。
- 不要为了通过检查而削弱测试或输入校验。
- 在同一个 pull request 中同时更新文档的英文版和简体中文版。
- pull request 的标题要描述用户可见的变化。发布说明由这些标题生成。
- 不要在提交、截图或日志中包含凭据、账号数据或私人对话内容。

## Pull request

创建分支或 fork，然后向 `main` 提交 pull request。

说明问题、最小修复方案以及你运行过的检查。无关的变更请放在单独的 pull request 中。

`main` 要求通过 pull request 合并，并且 `Check (Node 22)` 和 `Check (Node 24)` 检查要基于当前目标分支通过。
不需要他人审批，因此独立维护者可以在 CI 通过后合并。禁止强制推送和删除分支。

## 发布

只有仓库所有者可以发布。GitHub release 会触发 **Publish release**，并且所有者必须批准 `npm` 环境的部署。

不要在 pull request 中修改包版本。发布标签决定发布的版本。

### 发布流程

1. 在一个 pull request 中，在 `CHANGELOG.md` 顶部添加一条 `## [X.Y.Z] - YYYY-MM-DD` 记录，用用户能理解的话来写。修复选择 `patch`，兼容的新功能选择 `minor`，不兼容的变更选择 `major`。用户运行 `pi update` 后，Pi 会向他们显示这条记录。`CHANGELOG.md` 只用英文书写，因为 Pi 只读取这个文件。
2. 等待要发布的 `main` 提交的 CI 通过。
3. 在 GitHub 上打开 **Releases > Draft a new release**。
4. 在 `main` 上创建标签 `vX.Y.Z`。
5. 选择 **Generate release notes**，然后选择 **Publish release**。
6. 在 Actions 运行中批准 `npm` 环境的部署。

以下发布会被工作流拒绝：不是由所有者创建的发布、预发布、不符合 `vX.Y.Z` 的标签、不在 `main` 上的提交、CI 未通过的提交，或者 `CHANGELOG.md` 中没有对应记录的版本。工作流会运行 `npm run check`，根据标签设置包版本，并带 npm provenance 发布。新的 npm 发布会更新 `latest` dist-tag。

Release 和 `v*` 标签不可更改。如果发布因外部原因失败，请在原来的运行中使用 **Re-run failed jobs**。如果代码需要修复，请发布一个新版本。

工作流使用 npm 可信发布（trusted publishing），因此仓库中不保存 npm token。为本仓库、`release.yml` 和 GitHub 环境 `npm` 配置 npm 可信发布者。将该环境限制为 `v*` 标签，并将所有者设为必需审批人，允许自我审批。

## 安全

请通过[私密报告流程](SECURITY.zh-CN.md)报告安全漏洞。不要在公开 issue 中写入漏洞利用细节或凭据。
