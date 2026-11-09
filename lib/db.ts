import mongoose from "mongoose";
import { logger } from "./logger";
const globalDb = globalThis as typeof globalThis & { taskflowDb?: { connection: typeof mongoose | null; promise: Promise<typeof mongoose> | null } };
const cache = globalDb.taskflowDb ??= { connection: null, promise: null };
export async function connectDB() {
  if (cache.connection && mongoose.connection.readyState === 1) return cache.connection;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  try {
    cache.promise ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, bufferCommands: false });
    cache.connection = await cache.promise;
    cache.promise = null;
    return cache.connection;
  } catch {
    cache.promise = null; cache.connection = null;
    logger.error({ event: "database_connection_failed" }, "MongoDB connection failed");
    throw new Error("Database unavailable");
  }
}
