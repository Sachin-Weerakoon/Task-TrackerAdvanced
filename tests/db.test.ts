import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ connect: vi.fn(), connection: { readyState: 0 } }));
vi.mock("mongoose", () => ({ default: mocks }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); Reflect.deleteProperty(globalThis, "taskflowDb"); mocks.connection.readyState = 0; mocks.connect.mockReset(); });
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
});
