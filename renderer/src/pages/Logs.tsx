import { useState, useMemo } from "react";
import { useStore, type LogEntry } from "../store";
import { openLogDir } from "../api";

const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const LEVEL_BG: Record<string, string> = {
  info: "",
  warn: "bg-yellow-900/10",
  error: "bg-red-900/10",
};

export default function Logs() {
  const { logEntries } = useStore();
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return logEntries.filter((e) => {
      if (levelFilter !== "all" && e.level !== levelFilter) return false;
      if (search && !e.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logEntries, levelFilter, search]);

  const counts = useMemo(() => {
    const c = { all: logEntries.length, info: 0, warn: 0, error: 0 };
    for (const e of logEntries) c[e.level]++;
    return c;
  }, [logEntries]);

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("zh-CN", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">日志管理</h1>
        <button onClick={openLogDir} className="px-4 py-2 rounded-xl bg-surface-lighter hover:bg-slate-600 text-slate-200 text-sm font-semibold transition">
          打开日志目录
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-surface-light rounded-xl p-1 border border-slate-700">
          {(["all", "info", "warn", "error"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                levelFilter === level
                  ? "bg-accent text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {level === "all" ? "全部" : level.toUpperCase()}
              <span className="ml-1 opacity-60">{counts[level]}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索日志..."
          className="flex-1 px-3 py-1.5 rounded-xl bg-surface-light border border-slate-700 text-sm text-white outline-none focus:border-accent placeholder-slate-500"
        />
      </div>

      {/* Log entries */}
      <div className="flex-1 bg-surface-light rounded-2xl border border-slate-700 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">暂无日志</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-light">
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-2 text-slate-400 font-semibold w-24">时间</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-semibold w-16">级别</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-semibold">消息</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-semibold w-48">上下文</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <LogRow key={`${entry.time}-${i}`} entry={entry} formatTime={formatTime} />
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500">
          共 {filtered.length} 条日志{levelFilter !== "all" ? ` (过滤自 ${counts.all} 条)` : ""}
        </div>
      </div>
    </div>
  );
}

function LogRow({ entry, formatTime }: { entry: LogEntry; formatTime: (s: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const hasContext = entry.context && Object.keys(entry.context).length > 0;

  return (
    <tr
      className={`border-b border-slate-700/30 hover:bg-surface-lighter/30 transition ${LEVEL_BG[entry.level]} ${hasContext ? "cursor-pointer" : ""}`}
      onClick={() => hasContext && setExpanded(!expanded)}
    >
      <td className="px-4 py-2 font-mono text-slate-500 whitespace-nowrap align-top">{formatTime(entry.time)}</td>
      <td className={`px-4 py-2 font-semibold uppercase align-top ${LEVEL_COLORS[entry.level]}`}>{entry.level}</td>
      <td className="px-4 py-2 text-slate-300 align-top break-all">{entry.message}</td>
      <td className="px-4 py-2 text-slate-500 align-top">
        {hasContext && (
          expanded
            ? <pre className="text-xs font-mono whitespace-pre-wrap text-slate-400">{JSON.stringify(entry.context, null, 2)}</pre>
            : <span className="text-xs text-slate-600">点击展开</span>
        )}
      </td>
    </tr>
  );
}
