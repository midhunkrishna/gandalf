// Minimal leveled logger. Long-lived foreground commands (watch) want debug
// detail scrolling on stdout; one-shot commands stay quiet at "info". All
// levels write to STDOUT by design — stderr is reserved for fatal CLI usage
// errors (commander) so `gandalf watch > run.log` captures the whole story.

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Logger {
  level: LogLevel;
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export function isLogLevel(s: string): s is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(s);
}

export function createLogger(level: LogLevel = "info"): Logger {
  const threshold = LOG_LEVELS.indexOf(level);
  const emit = (lvl: LogLevel, msg: string) => {
    if (LOG_LEVELS.indexOf(lvl) < threshold) return;
    const time = new Date().toISOString();
    process.stdout.write(`${time} [${lvl.padEnd(5)}] ${msg}\n`);
  };
  return {
    level,
    debug: (m) => emit("debug", m),
    info: (m) => emit("info", m),
    warn: (m) => emit("warn", m),
    error: (m) => emit("error", m),
  };
}

/** A logger that swallows everything — for tests and pure callers. */
export const silentLogger: Logger = {
  level: "error",
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
