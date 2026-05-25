// src/lib/logger/logger.ts

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  details?: any;
}

class TelemetryLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private listeners: Set<(log: LogEntry) => void> = new Set();

  log(level: LogLevel, context: string, message: string, details?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      details,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Print to server or browser console
    const color = level === "ERROR" ? "\x1b[31m" : level === "WARN" ? "\x1b[33m" : "\x1b[32m";
    const reset = "\x1b[0m";
    console.log(
      `[${entry.timestamp}] [${color}${level}${reset}] [${context}] ${message}`,
      details ? details : ""
    );

    this.listeners.forEach((listener) => listener(entry));
  }

  info(context: string, message: string, details?: any) {
    this.log("INFO", context, message, details);
  }

  warn(context: string, message: string, details?: any) {
    this.log("WARN", context, message, details);
  }

  error(context: string, message: string, details?: any) {
    this.log("ERROR", context, message, details);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }

  subscribe(listener: (log: LogEntry) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// Global singleton instance
const globalForTelemetry = global as unknown as { telemetryLogger: TelemetryLogger };
export const logger = globalForTelemetry.telemetryLogger || new TelemetryLogger();

if (process.env.NODE_ENV !== "production") {
  globalForTelemetry.telemetryLogger = logger;
}

export default logger;
