type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function writeLog(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    ...(context ? { context } : {}),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  info(message: string, context?: LogContext) {
    writeLog("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    writeLog("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    writeLog("error", message, context);
  },
};

export function toLoggableError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  return { value: error };
}
