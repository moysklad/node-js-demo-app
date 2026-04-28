import pino from "pino";
import { cfg, type LogLevel } from "../config/config";

const LOG_LEVELS = {
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4
} as const;

const logger = createLogger();

export function logMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[cfg().logLevel]) {
    return;
  }

  logger[level.toLowerCase() as "debug" | "info" | "warn" | "error"]({ ...(meta ? { meta } : {}) }, message);
}

function createLogger(): pino.Logger {
  const level = cfg().logLevel.toLowerCase();
  const usePretty = process.env.NODE_ENV !== "production";

  if (usePretty) {
    return pino(
      { level },
      pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: true,
          translateTime: "SYS:standard"
        }
      })
    );
  }

  return pino({ level });
}
