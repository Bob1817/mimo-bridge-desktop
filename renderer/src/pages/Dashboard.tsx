import { useStore } from "../store";
import { startGateway, stopGateway, copyText } from "../api";

export default function Dashboard() {
  const { gatewayRunning, gatewayPort, providers, modelMappings } = useStore();

  const baseUrl = `http://localhost:${gatewayPort || "..."}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>

      {/* Status */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-light rounded-2xl p-5 border border-slate-700">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">网关</div>
          <div className={`text-2xl font-bold ${gatewayRunning ? "text-emerald-400" : "text-red-400"}`}>
            {gatewayRunning ? "运行中" : "已停止"}
          </div>
          {gatewayRunning && <div className="text-sm text-slate-400 mt-1">{baseUrl}</div>}
        </div>
        <div className="bg-surface-light rounded-2xl p-5 border border-slate-700">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">服务商</div>
          <div className="text-2xl font-bold text-blue-400">{providers.filter((p) => p.apiKey).length}<span className="text-sm text-slate-500 ml-1">/ {providers.length}</span></div>
          <div className="text-sm text-slate-400 mt-1">已配置</div>
        </div>
        <div className="bg-surface-light rounded-2xl p-5 border border-slate-700">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">模型映射</div>
          <div className="text-2xl font-bold text-purple-400">{modelMappings.length}</div>
          <div className="text-sm text-slate-400 mt-1">活跃规则</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button onClick={startGateway} className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition">
          启动网关
        </button>
        <button onClick={stopGateway} className="px-5 py-2.5 rounded-xl bg-surface-lighter hover:bg-slate-600 text-slate-200 font-semibold text-sm transition">
          停止网关
        </button>
        <button onClick={() => copyText(baseUrl)} className="px-5 py-2.5 rounded-xl bg-surface-lighter hover:bg-slate-600 text-slate-200 font-semibold text-sm transition">
          复制基础 URL
        </button>
      </div>

      {/* Quick Config */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-light rounded-2xl p-5 border border-slate-700">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Claude Code 配置</div>
          <pre className="text-xs text-slate-300 bg-surface rounded-xl p-3 overflow-auto">{`{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-local",
    "ANTHROPIC_BASE_URL": "${baseUrl}",
    "ANTHROPIC_MODEL": "${modelMappings[0]?.cursorModel || "claude-3-7-sonnet"}"
  }
}`}</pre>
          <button
            onClick={() => copyText(JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: "sk-local", ANTHROPIC_BASE_URL: baseUrl, ANTHROPIC_MODEL: modelMappings[0]?.cursorModel || "claude-3-7-sonnet" } }, null, 2))}
            className="mt-3 text-xs px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 font-semibold transition"
          >
            复制到剪贴板
          </button>
        </div>
        <div className="bg-surface-light rounded-2xl p-5 border border-slate-700">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Cursor 配置</div>
          <pre className="text-xs text-slate-300 bg-surface rounded-xl p-3 overflow-auto">{`{
  "apiKey": "sk-local",
  "baseUrl": "${baseUrl}/v1",
  "model": "${modelMappings[0]?.cursorModel || "claude-3-7-sonnet"}"
}`}</pre>
          <button
            onClick={() => copyText(JSON.stringify({ apiKey: "sk-local", baseUrl: `${baseUrl}/v1`, model: modelMappings[0]?.cursorModel || "claude-3-7-sonnet" }, null, 2))}
            className="mt-3 text-xs px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 font-semibold transition"
          >
            复制到剪贴板
          </button>
        </div>
      </div>
    </div>
  );
}
