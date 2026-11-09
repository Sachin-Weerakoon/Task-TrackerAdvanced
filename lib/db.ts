import mongoose from "mongoose";
import { logger } from "./logger";
import { mongodbUri } from "./env";
const globalDb = globalThis as typeof globalThis & { taskflowDb?: { connection: typeof mongoose | null; promise: Promise<typeof mongoose> | null } };
const cache = globalDb.taskflowDb ??= { connection: null, promise: null };
// Only log known diagnostic codes; raw driver errors can include credentials,
// connection strings and Atlas hostnames, including in nested causes.
const diagnosticCodes = new Set(["ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"]);
function connectionFailureCodes(error: unknown): string[] {
  if (typeof error !== "object" || error === null) return [];
  const failure = error as { code?: unknown; cause?: unknown; reason?: { servers?: unknown } };
  const codes = typeof failure.code === "string" && diagnosticCodes.has(failure.code) ? [failure.code] : [];
  const cause = failure.cause;
  if (typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string" && diagnosticCodes.has(cause.code)) codes.push(cause.code);
  if (failure.reason?.servers instanceof Map) {
    for (const server of failure.reason.servers.values()) {
      // Driver topology errors are not serialized; inspect only their codes.
      if (server && typeof server === "object" && "error" in server) {
        const serverError = server.error as { code?: unknown; cause?: { code?: unknown } } | null;
        for (const code of [serverError?.code, serverError?.cause?.code]) {
          if (typeof code === "string" && diagnosticCodes.has(code)) codes.push(code);
        }
      }
    }
  }
  return [...new Set(codes)];
}
export async function connectDB() {
  if (cache.connection && mongoose.connection.readyState === 1) return cache.connection;
  const uri = mongodbUri();
  try {
    cache.promise ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, bufferCommands: false });
    cache.connection = await cache.promise;
    cache.promise = null;
    return cache.connection;
  } catch (error) {
    cache.promise = null; cache.connection = null;
    logger.error({ event: "database_connection_failed", err: error, failureCodes: connectionFailureCodes(error) }, "MongoDB connection failed");
    throw new Error("Database unavailable", { cause: error });
  }
}
