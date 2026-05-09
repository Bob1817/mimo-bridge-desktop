import { useStore } from "../store";

const NAV_ITEMS = [
  { id: "dashboard", label: "仪表盘", icon: "⬡" },
  { id: "providers", label: "服务商", icon: "⚙" },
  { id: "mappings", label: "模型映射", icon: "⇄" },
  { id: "logs", label: "日志", icon: "◉" },
  { id: "settings", label: "设置", icon: "☰" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { page, setPage, gatewayRunning, gatewayPort, version, updateInfo } = useStore();

  const updateBanner = updateInfo.status === "available" || updateInfo.status === "downloaded" || updateInfo.status === "downloading";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-light border-r border-slate-700 flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center font-bold text-lg">M</div>
            <div>
              <div className="font-bold text-sm">MIMO Gateway</div>
              <div className="text-xs text-slate-400">AI 编程代理</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                page === item.id ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-slate-400 hover:bg-surface-lighter hover:text-slate-200"
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${gatewayRunning ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-slate-400">{gatewayRunning ? `运行中 :${gatewayPort}` : "已停止"}</span>
          </div>
          <div className="text-xs text-slate-500">v{version}</div>
          {updateBanner && (
            <div className="text-xs bg-emerald-900/40 border border-emerald-700/50 rounded-lg px-3 py-2 text-emerald-300">
              更新 {updateInfo.status === "downloading" ? `(${updateInfo.percent}%)` : updateInfo.status === "downloaded" ? "就绪" : "可用"}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
