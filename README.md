# MIMO Bridge Desktop

本地 AI 编程代理网关，将 AI 编程工具（Claude Code、Cursor 等）的请求转发到自定义服务商（MIMO、DeepSeek、Spark、通义千问等），支持自动模型名称映射和流式响应。

## 功能

- **多服务商支持**：配置多个 AI 服务商，统一管理 API Key
- **模型映射**：将前端模型名称（如 `claude-sonnet-4-20250514`）映射到实际模型（如 `mimo-v2.5-pro`）
- **格式兼容**：同时支持 OpenAI 和 Anthropic 协议格式，自动转换
- **流式传输**：完整支持 SSE 流式响应
- **日志管理**：按级别过滤、搜索，日志文件按天分割持久化
- **自动更新**：内置应用自动更新机制

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
npm run dev
```

如 Electron 下载慢：

```bash
npm config set registry https://registry.npmmirror.com
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 使用方式

### 1. 配置服务商

在「服务商」页面添加你的 API 服务商，填写名称、类型、Base URL 和 API Key。

### 2. 配置模型映射

在「模型映射」页面设置前端模型名到实际模型的映射关系。例如：

| 前端模型 | 服务商 | 实际模型 |
|---|---|---|
| claude-sonnet-4-20250514 | mimo | mimo-v2.5-pro |
| deepseek-r1 | deepseek | deepseek-reasoner |

### 3. 启动网关

在「仪表盘」页面点击「启动网关」，默认监听 `8788` 端口。

### 4. 配置 AI 工具

**Claude Code：** 在项目根目录创建 `.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-local",
    "ANTHROPIC_BASE_URL": "http://localhost:8788",
    "ANTHROPIC_MODEL": "claude-sonnet-4-20250514"
  }
}
```

**Cursor：** 在 Cursor 设置中配置：

```json
{
  "apiKey": "sk-local",
  "baseUrl": "http://localhost:8788/v1",
  "model": "claude-sonnet-4-20250514"
}
```

配置片段可在仪表盘页面直接复制。

## 项目结构

```
src/
  main.ts              # Electron 主进程
  preload.ts           # IPC 桥接
  gateway/
    config.ts          # 配置管理
    server.ts          # Express 网关服务
    proxy.ts           # 请求代理
    converter.ts       # 协议格式转换
    port.ts            # 端口检测
    logger.ts          # 日志管理
renderer/src/
  App.tsx              # 根组件
  store.ts             # 状态管理 (Zustand)
  api.ts               # IPC 通信
  components/Layout.tsx
  pages/
    Dashboard.tsx      # 仪表盘
    Providers.tsx      # 服务商管理
    ModelMap.tsx       # 模型映射
    Logs.tsx           # 日志查看
    Settings.tsx       # 设置
```

## 日志

日志文件保存在 `~/.mimo-bridge-desktop/logs/` 目录下，按天分割（`YYYY-MM-DD.log`）。可在应用内「日志」页面按级别（INFO/WARN/ERROR）过滤和搜索。
