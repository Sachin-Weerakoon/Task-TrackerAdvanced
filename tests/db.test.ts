import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ connect: vi.fn(), connection: { readyState: 0 }, logError: vi.fn() }));
vi.mock("mongoose", () => ({ default: mocks }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); Reflect.deleteProperty(globalThis, "taskflowDb"); mocks.connection.readyState = 0; mocks.connect.mockReset(); mocks.logError.mockReset(); });
describe("MongoDB connection lifecycle", () => {
  it("does not connect during module import and requires a URI at request time", async () => {
    vi.stubEnv("MONGODB_URI", ""); const { connectDB } = await import("@/lib/db");
    expect(mocks.connect).not.toHaveBeenCalled(); await expect(connectDB()).rejects.toThrow("MONGODB_URI");
  });
  it("shares concurrent connection attempts and reuses active connections", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb://localhost/taskflow_test");
    mocks.connect.mockImplementation(async () => { mocks.connection.readyState = 1; return mocks; });
    const { connectDB } = await import("@/lib/db"); await Promise.all([connectDB(), connectDB()]); await connectDB(); expect(mocks.connect).toHaveBeenCalledTimes(1);
  });
  it("allows a retry after a failed connection without leaking its error", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb://localhost/taskflow_test"); mocks.connect.mockRejectedValueOnce(new Error("sensitive URI"));
    const { connectDB } = await import("@/lib/db"); await expect(connectDB()).rejects.toThrow("Database unavailable");
    mocks.connect.mockResolvedValueOnce(mocks); await connectDB(); expect(mocks.connect).toHaveBeenCalledTimes(2);
  });
  it("reconnects after a connection is dropped", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb://localhost/taskflow_test"); mocks.connect.mockImplementation(async () => { mocks.connection.readyState = 1; return mocks; });
    const { connectDB } = await import("@/lib/db"); await connectDB(); mocks.connection.readyState = 0; await connectDB(); expect(mocks.connect).toHaveBeenCalledTimes(2);
  });
  it("logs allowlisted TLS diagnostics without leaking nested driver details", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb://localhost/taskflow_test");
    const failure = Object.assign(new Error("mongodb://private:password@private-host"), {
      reason: { servers: new Map([
        ["private-host", { error: Object.assign(new Error("private credentials"), { cause: { code: "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR", message: "private credentials" } }) }],
        ["another-private-host", { error: { code: "private credentials", cause: { code: "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR" } } }],
      ]) },
    });
    mocks.connect.mockRejectedValueOnce(failure);
    const { connectDB } = await import("@/lib/db");
    await expect(connectDB()).rejects.toThrow("Database unavailable");
    expect(mocks.logError).toHaveBeenCalledWith({ event: "database_connection_failed", err: failure, failureCodes: ["ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR"] }, "MongoDB connection failed");
  });
});
