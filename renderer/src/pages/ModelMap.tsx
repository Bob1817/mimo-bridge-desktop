import { useState } from "react";
import { useStore, type ModelMapping } from "../store";
import { saveMappings } from "../api";

export default function ModelMap() {
  const { modelMappings, providers } = useStore();
  const [editing, setEditing] = useState<ModelMapping | null>(null);

  function handleSave(m: ModelMapping) {
    const next = modelMappings.map((x) => (x.cursorModel === m.cursorModel ? m : x));
    if (!next.find((x) => x.cursorModel === m.cursorModel)) next.push(m);
    saveMappings(next);
    setEditing(null);
  }

  function handleDelete(cursorModel: string) {
    saveMappings(modelMappings.filter((m) => m.cursorModel !== cursorModel));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">模型映射</h1>
        <button onClick={() => setEditing({ cursorModel: "", providerName: providers[0]?.name || "", realModel: "" })} className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition">
          + 添加映射
        </button>
      </div>

      <div className="bg-surface-light rounded-2xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">前端模型</th>
              <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">服务商</th>
              <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">实际模型</th>
              <th className="text-right px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {modelMappings.map((m) => (
              <tr key={m.cursorModel} className="border-b border-slate-700/50 hover:bg-surface-lighter/50 transition">
                <td className="px-5 py-3 font-mono text-blue-300">{m.cursorModel}</td>
                <td className="px-5 py-3 text-slate-300">{m.providerName}</td>
                <td className="px-5 py-3 font-mono text-purple-300">{m.realModel}</td>
                <td className="px-5 py-3 text-right space-x-2">
                  <button onClick={() => setEditing(m)} className="px-3 py-1 rounded-lg bg-surface-lighter hover:bg-slate-600 text-xs font-semibold text-slate-300 transition">编辑</button>
                  <button onClick={() => handleDelete(m.cursorModel)} className="px-3 py-1 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-xs font-semibold text-red-400 transition">删除</button>
                </td>
              </tr>
            ))}
            {modelMappings.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">暂无映射配置。</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <MappingEditor mapping={editing} providers={providers} onSave={handleSave} onCancel={() => setEditing(null)} />}
    </div>
  );
}

function MappingEditor({ mapping, providers, onSave, onCancel }: { mapping: ModelMapping; providers: { name: string }[]; onSave: (m: ModelMapping) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...mapping });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-light rounded-2xl p-6 border border-slate-700 w-[480px] space-y-4">
        <h2 className="font-bold text-lg">{mapping.cursorModel ? "编辑映射" : "添加映射"}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-semibold">前端模型名称</label>
            <input value={form.cursorModel} onChange={(e) => setForm({ ...form, cursorModel: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-slate-600 text-sm text-white outline-none focus:border-accent font-mono" placeholder="claude-3-7-sonnet" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold">服务商</label>
            <select value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-slate-600 text-sm text-white outline-none focus:border-accent">
              {providers.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold">实际模型名称</label>
            <input value={form.realModel} onChange={(e) => setForm({ ...form, realModel: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-slate-600 text-sm text-white outline-none focus:border-accent font-mono" placeholder="mimo-v2.5-pro" />
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
