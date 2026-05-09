import { useState } from "react";
import { useStore } from "../store";
import { saveConfig, type MimoBridge } from "../api";

const mimo = (window as unknown as { mimo: MimoBridge }).mimo;

export default function Settings() {
  const { config, updateInfo } = useStore();
  const [port, setPort] = useState(String(config.port || 8788));
  const [defaultProvider, setDefaultProvider] = useState(String(config.defaultProvider || ""));

  function handleSavePort() {
    saveConfig({ port: Number(port) });
  }

  function handleSaveDefault() {
    saveConfig({ defaultProvider });
  }

  async function handleCheckUpdate() {
    await mimo.checkUpdate();
  }

  async function handleDownload() {
    await mimo.downloadUpdate();
  }

  function handleInstall() {
    mimo.installUpdate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">设置</h1>

      {/* Port */}
      <div className="bg-surface-light rounded-2xl p-5 border border-slate-700">
        <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">网关端口</div>
        <div className="flex gap-3 items-center">
          <input type="number" value={port} onChange={(e) => setPort(e.target.value)} className="w-32 px-3 py-2 rounded-xl bg-surface border border-slate-600 text-sm text-white outline-none focus:border-accent" />
          <button onClick={handleSavePort} className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition">保存</button>
        </div>
        <div className="text-xs text-slate-500 mt-2">默认: 8788。修改端口后需重启生效。</div>
      </div>

      {/* Default Provider */}
      <div className="bg-surface-light rounded-2xl p-5 border border-slate-700">
        <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">默认服务商</div>
        <div className="flex gap-3 items-center">
          <select value={defaultProvider} onChange={(e) => setDefaultProvider(e.target.value)} className="px-3 py-2 rounded-xl bg-surface border border-slate-600 text-sm text-white outline-none focus:border-accent">
            <option value="">无</option>
            {(config.providers as { name: string }[] || []).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button onClick={handleSaveDefault} className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition">保存</button>
        </div>
        <div className="text-xs text-slate-500 mt-2">当没有匹配的模型映射时，使用此服务商作为后备。</div>
      </div>

      {/* Updates */}
      <div className="bg-surface-light rounded-2xl p-5 border border-slate-700">
        <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">应用更新</div>
        <div className="flex gap-3 items-center">
          <button onClick={handleCheckUpdate} className="px-4 py-2 rounded-xl bg-surface-lighter hover:bg-slate-600 text-slate-200 text-sm font-semibold transition">检查更新</button>
          {updateInfo.status === "available" && (
            <button onClick={handleDownload} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition">下载更新</button>
          )}
          {updateInfo.status === "downloading" && (
            <span className="text-sm text-blue-400">下载中... {updateInfo.percent}%</span>
          )}
          {updateInfo.status === "downloaded" && (
            <button onClick={handleInstall} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition">重启并安装</button>
          )}
          {updateInfo.status === "not-available" && <span className="text-sm text-emerald-400">已是最新版本</span>}
          {updateInfo.status === "error" && <span className="text-sm text-red-400">检查失败</span>}
        </div>
      </div>
    </div>
  );
}
