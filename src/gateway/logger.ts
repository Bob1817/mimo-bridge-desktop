import fs from "fs";
import path from "path";
import { APP_DIR } from "./config.js";

const LOG_DIR = path.join(APP_DIR, "logs");

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function todayFile(): string {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return path.join(LOG_DIR, `${date}.log`);
}

function formatEntry(entry: LogEntry): string {
  const ctx = entry.context ? ` | ${JSON.stringify(entry.context)}` : "";
  return `${entry.time} [${entry.level.toUpperCase()}] ${entry.message}${ctx}\n`;
}

class Logger {
  private listeners: ((entry: LogEntry) => void)[] = [];

  subscribe(cb: (entry: LogEntry) => void) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      time: new Date().toISOString(),
      level,
      message,
      context,
    };

    // Console output
    const consoleMsg = `[${level.toUpperCase()}] ${message}`;
    if (level === "error") console.error(consoleMsg, context || "");
    else if (level === "warn") console.warn(consoleMsg, context || "");
    else console.log(consoleMsg);

    // File output
    try {
      ensureLogDir();
      fs.appendFileSync(todayFile(), formatEntry(entry));
    } catch {}

    // Notify listeners
    for (const cb of this.listeners) {
      try { cb(entry); } catch {}
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.write("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.write("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.write("error", message, context);
  }

  getLogDir(): string {
    ensureLogDir();
    return LOG_DIR;
  }

  getRecentLogs(count = 200): LogEntry[] {
    try {
      ensureLogDir();
      const files = fs.readdirSync(LOG_DIR)
        .filter((f) => f.endsWith(".log"))
        .sort()
        .reverse();
      const lines: LogEntry[] = [];
      for (const file of files) {
        const content = fs.readFileSync(path.join(LOG_DIR, file), "utf8");
        for (const line of content.split("\n").reverse()) {
          if (!line.trim()) continue;
          const match = line.match(/^(\S+)\s+\[(\w+)\]\s+(.*?)(?:\s+\|\s+(.*))?$/);
          if (match) {
            lines.push({
              time: match[1],
              level: match[2].toLowerCase() as LogLevel,
              message: match[3],
              context: match[4] ? JSON.parse(match[4]) : undefined,
            });
          }
          if (lines.length >= count) return lines;
        }
      }
      return lines;
    } catch {
      return [];
    }
  }

  getLogFiles(): string[] {
    try {
      ensureLogDir();
      return fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".log")).sort().reverse();
    } catch {
      return [];
    }
  }
}

export const logger = new Logger();
