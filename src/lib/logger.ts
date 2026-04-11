export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

function getLogLevel(): LogLevel {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL
      : undefined;

  if (typeof raw !== "string") return "warn";
  const normalized = raw.toLowerCase() as LogLevel;
  return normalized in LEVELS ? normalized : "info";
}

const currentLevel = LEVELS[getLogLevel()];

function shouldLog(level: LogLevel) {
  return currentLevel <= LEVELS[level];
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog("debug")) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog("info")) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (shouldLog("error")) console.error(...args);
  },
};
