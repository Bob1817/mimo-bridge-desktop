import { useState } from "react";
import { useStore, type Provider } from "../store";
import { saveProviders } from "../api";

export default function Providers() {
  const { providers } = useStore();
  const [editing, setEditing] = useState<Provider | null>(null);

  function handleSave(p: Provider) {
    const next = providers.map((x) => (x.name === p.name ? p : x));
    if (!next.find((x) => x.name === p.name)) next.push(p);
    saveProviders(next);
    setEditing(null);
  }

  function handleDelete(name: string) {
    saveProviders(providers.filter((p) => p.name !== name));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">服务商</h1>
        <button onClick={() => setEditing({ name: "", type: "openai", baseUrl: "", apiKey: "" })} className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition">
          + 添加服务商
        </button>
      </div>

      <div className="grid gap-3">
        {providers.map((p) => (
          <div key={p.name} className="bg-surface-light rounded-2xl p-5 border border-slate-700 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm">{p.name}</div>
              <div className="text-xs text-slate-400 mt-1">{p.type.toUpperCase()} · {p.baseUrl}</div>
              <div className="text-xs text-slate-500 mt-0.5">密钥: {p.apiKey ? "••••••••" : "未设置"}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(p)} className="px-3 py-1.5 rounded-lg bg-surface-lighter hover:bg-slate-600 text-xs font-semibold text-slate-300 transition">编辑</button>
              <button onClick={() => handleDelete(p.name)} className="px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-xs font-semibold text-red-400 transition">删除</button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      {editing && (
        <ProviderEditor provider={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}

function ProviderEditor({ provider, onSave, onCancel }: { provider: Provider; onSave: (p: Provider) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...provider });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-light rounded-2xl p-6 border border-slate-700 w-[480px] space-y-4">
        <h2 className="font-bold text-lg">{provider.name ? "编辑服务商" : "添加服务商"}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-semibold">名称</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-slate-600 text-sm text-white outline-none focus:border-accent" placeholder="例如 spark" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold">类型</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "openai" | "anthropic" })} className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-slate-600 text-sm text-white outline-none focus:border-accent">
              <option value="openai">OpenAI 兼容</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold">基础 URL</label>
            <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-slate-600 text-sm text-white outline-none focus:border-accent" placeholder="https://api.example.com/v1" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold">API 密钥</label>
            <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-slate-600 text-sm text-white outline-none focus:border-accent" placeholder="sk-..." />
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-surface-lighter text-slate-300 text-sm font-semibold hover:bg-slate-600 transition">取消</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition">保存</button>
        </div>
      </div>
    </div>
  );
}
