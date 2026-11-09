import { afterEach, describe, expect, it, vi } from "vitest";
import { jwtSecret, mongodbUri, validateServerEnv } from "@/lib/env";
import { register } from "@/instrumentation";

afterEach(() => vi.unstubAllEnvs());
const configured = () => {
  vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1/taskflow_test");
  vi.stubEnv("JWT_SECRET", "test-secret-of-at-least-thirty-two-bytes");
};

describe("server environment validation", () => {
  it.each(["", "   "])("rejects a missing MongoDB URI with a clear message (%j)", value => {
    vi.stubEnv("MONGODB_URI", value);
    expect(mongodbUri).toThrow("MONGODB_URI is required");
  });
  it("rejects invalid MongoDB syntax without exposing its value", () => {
    vi.stubEnv("MONGODB_URI", "https://private:credential@example.com");
    expect(mongodbUri).toThrow(/^MONGODB_URI must be a MongoDB connection string$/);
  });
  it.each(["mongodb://host1:27017,host2:27017/taskflow?replicaSet=rs0", "mongodb+srv://user:encoded%40password@cluster.example.com/taskflow?retryWrites=true"])("accepts supported connection string formats", uri => {
    vi.stubEnv("MONGODB_URI", uri);
    expect(mongodbUri()).toBe(uri);
  });
  it("requires a secret and enforces a UTF-8 byte minimum", () => {
    vi.stubEnv("JWT_SECRET", "");
    expect(jwtSecret).toThrow("JWT_SECRET is required");
    vi.stubEnv("JWT_SECRET", "short-private-secret");
    expect(jwtSecret).toThrow(/^JWT_SECRET must contain at least 32 bytes$/);
    vi.stubEnv("JWT_SECRET", "é".repeat(16));
    expect(jwtSecret()).toBe("é".repeat(16));
  });
  it("validates all required configuration without connecting to MongoDB", () => {
    configured();
    expect(validateServerEnv).not.toThrow();
    vi.stubEnv("JWT_SECRET", "");
    expect(validateServerEnv).toThrow("JWT_SECRET is required");
  });
  it.each(["development", "production"])("fails before serving requests in %s, including standalone", async mode => {
    configured();
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "");
    await expect(register()).resolves.toBeUndefined();
    vi.stubEnv("MONGODB_URI", "");
    await expect(register()).rejects.toThrow("MONGODB_URI is required");
    vi.stubEnv("MONGODB_URI", "mongodb://localhost/taskflow_test");
    vi.stubEnv("JWT_SECRET", "");
    await expect(register()).rejects.toThrow("JWT_SECRET is required");
  });
  it("can import modules and run build instrumentation without runtime secrets", async () => {
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.resetModules();
    const instrumentation = await import("@/instrumentation");
    await expect(instrumentation.register()).resolves.toBeUndefined();
    await expect(import("@/lib/env")).resolves.toBeDefined();
  });
  it("does not require database credentials in the Edge runtime", async () => {
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await expect(register()).resolves.toBeUndefined();
  });
});
