# MIMO Bridge Desktop V2

这是一个可视化桌面代理工具，支持：

- Claude Code / Anthropic 兼容代理
- Codex / OpenAI 兼容代理
- 在工具中切换 Claude Code 模式和 Codex 模式
- 自动写入 Claude Code 配置：`~/.claude/settings.json`
- 自动写入 Codex 配置：`~/.codex/config.toml`
- 自动写入 Codex 环境变量到 `~/.zshrc` 或 `~/.bash_profile`

## 下载安装

从 [GitHub Releases](https://github.com/Bob1817/mimo-bridge-desktop/releases) 下载最新版本：

- **macOS (Apple Silicon)**: 下载 `.dmg` 文件，双击打开后将 `MIMO Bridge` 拖入「应用程序」

### macOS 提示"已损坏"的解决方法

由于应用未经 Apple 签名，macOS 可能提示「"MIMO Bridge"已损坏，无法打开」。解决方法（二选一）：

**方法一：** 右键点击应用 → 选择「打开」→ 在弹窗中再次点击「打开」

**方法二：** 打开终端执行：

```bash
sudo xattr -r -d com.apple.quarantine "/Applications/MIMO Bridge.app"
```

## 从源码运行

```bash
git clone https://github.com/Bob1817/mimo-bridge-desktop.git
cd mimo-bridge-desktop
npm install
npm start
```

如 Electron 下载慢：

```bash
npm config set registry https://registry.npmmirror.com
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
rm -rf node_modules package-lock.json
npm install
npm start
```

## Claude Code 使用方式

在「统一配置」里填写：

```txt
Claude/MIMO Base URL
Claude/MIMO API Key
上游真实模型：mimo-v2.5-pro
Claude Code 侧模型：claude-sonnet-4-20250514
```

然后在「Claude Code」页点击：

```txt
一键写入
```

Claude Code 内使用：

```txt
/model
```

选择：

```txt
claude-sonnet-4-20250514
```

不要直接选择 `mimo-v2.5-pro`。

## Codex 使用方式

在「统一配置」里填写：

```txt
Codex 上游 Base URL
Codex API Key
Codex 模型
Codex Provider ID
```

然后在「Codex」页点击：

```txt
一键写入 config.toml
写入环境变量
```

重新打开终端，或执行：

```bash
source ~/.zshrc
```

然后启动：

```bash
codex
```

## Codex 生成的配置示例

```toml
model = "gpt-5-codex"
model_provider = "mimo_proxy"

[model_providers.mimo_proxy]
name = "MIMO Bridge Proxy"
base_url = "http://localhost:8787/codex/v1"
env_key = "MIMO_BRIDGE_CODEX_API_KEY"
wire_api = "responses"
request_max_retries = 4
stream_max_retries = 10
stream_idle_timeout_ms = 300000
```

## 注意

- Codex 的 `env_key` 是环境变量名，不是 API Key 明文。
- 如 Codex 上游只支持 Chat Completions，可把 `wire_api` 改为 `chat`。
- 默认推荐 `responses`。
