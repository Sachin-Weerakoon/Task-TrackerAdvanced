import pino from "pino";
export const logger = pino({ level: process.env.LOG_LEVEL || "info", base: { service: "taskflow" }, redact: { paths: ["password", "passwordHash", "token", "secret", "req.headers.cookie", "req.headers.authorization"], censor: "[REDACTED]" } });
