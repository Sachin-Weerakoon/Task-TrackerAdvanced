import pino from "pino";

function redactText(text: string): string {
  const sensitive = [process.env.MONGODB_URI, process.env.JWT_SECRET];
  // Driver messages may print database credentials separately from the URI.
  const credentials = process.env.MONGODB_URI?.match(/^mongodb(?:\+srv)?:\/\/([^@/]+)@/)?.[1];
  for (const value of credentials?.split(":") ?? []) {
    sensitive.push(value);
    try { sensitive.push(decodeURIComponent(value)); } catch { /* Invalid encoding is still redacted verbatim. */ }
  }
  for (const value of sensitive.filter((value): value is string => !!value).sort((a, b) => b.length - a.length)) {
    text = text.split(value).join("[REDACTED]");
  }
  return text
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, "[REDACTED]")
    .replace(/\bBearer\s+[^\s"',;]+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/(\b(?:password(?:Hash)?|JWT_SECRET|MONGODB_URI|secret|token|taskflow_session|username|credentials)\b["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi, "$1[REDACTED]");
}

export function serializeError(error: unknown): Record<string, string | number> {
  // Standard Pino serialization includes cause messages/stacks. Whitelist the
  // output fields: enumerable driver metadata can contain entire credentials.
  const serialized = pino.stdSerializers.err(error as Error) as Record<string, unknown> | null;
  if (!serialized || typeof serialized !== "object") return { type: "UnknownError" };
  const safe: Record<string, string | number> = {};
  for (const field of ["type", "message", "stack", "code"]) {
    const value = serialized[field];
    if (typeof value === "string") safe[field] = redactText(value);
    else if (field === "code" && typeof value === "number") safe[field] = value;
  }
  return safe;
}

export const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  base: { service: "taskflow" },
  // Pino also derives `msg` from err.message when no message is supplied.
  serializers: { err: serializeError, msg: (message: unknown) => typeof message === "string" ? redactText(message) : message },
  redact: {
    paths: ["password", "passwordHash", "token", "secret", "JWT_SECRET", "MONGODB_URI", "username", "credentials", "*.password", "*.passwordHash", "*.token", "*.secret", "*.JWT_SECRET", "*.MONGODB_URI", "*.username", "*.credentials", "req.headers.cookie", "req.headers.authorization"],
    censor: "[REDACTED]",
  },
};
export const logger = pino(loggerOptions);
