import { afterEach, describe, expect, it, vi } from "vitest";
import pino from "pino";
import { logger, loggerOptions } from "@/lib/logger";
import { endpoint } from "@/lib/api";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function captureLogger() {
  const lines: string[] = [];
  return { lines, log: pino(loggerOptions, { write: (line: string) => { lines.push(line); } }) };
}

describe("safe server error logging", () => {
  it("uses Pino error type/message/stack and preserves diagnostic codes", () => {
    const { lines, log } = captureLogger();
    const err = Object.assign(new TypeError("Connection failed"), { code: "ECONNRESET" });
    log.error({ err }, "API request failed");
    expect(JSON.parse(lines[0]).err).toMatchObject({ type: "TypeError", message: "Connection failed", code: "ECONNRESET" });
    expect(JSON.parse(lines[0]).err.stack).toContain("logger.test.ts");
  });
  it("redacts secrets in messages, stacks and causes and drops arbitrary error metadata", () => {
    const secret = "configured-private-signing-secret-of-32-bytes";
    const uri = "mongodb+srv://database-user:database%40password@cluster.example.com/taskflow";
    vi.stubEnv("JWT_SECRET", secret);
    vi.stubEnv("MONGODB_URI", uri);
    const cause = new Error(`Connection to ${uri} failed; credentials database-user database@password; ${secret}`);
    const err = Object.assign(new Error('password="private password with spaces" token=private-token', { cause }), {
      code: 18, password: "hidden-password", reason: { password: "nested-password", uri }, keyValue: { email: "private-email" },
    });
    const { lines, log } = captureLogger();
    log.error({ err }, "Database error");
    const output = lines.join("");
    for (const sensitive of [secret, uri, "database-user", "database%40password", "database@password", "private password with spaces", "private-token", "hidden-password", "nested-password", "private-email"]) expect(output).not.toContain(sensitive);
    expect(JSON.parse(lines[0]).err.code).toBe(18);
    expect(JSON.parse(lines[0]).err.stack).toContain("caused by:");
    expect(JSON.parse(lines[0]).err).not.toHaveProperty("reason");
  });
  it("redacts unconfigured MongoDB URIs, bearer tokens, JWTs and session cookies", () => {
    const { lines, log } = captureLogger();
    const error = new Error("mongodb://other-user:other-password@host/db Bearer bearer-value eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature taskflow_session=cookie-value");
    log.error({ err: error });
    log.error(error);
    log.error("password=message-password");
    for (const sensitive of ["other-user", "other-password", "bearer-value", "eyJhbGci", "cookie-value", "message-password"]) expect(lines.join("")).not.toContain(sensitive);
  });
  it("keeps structural redaction for authentication fields and request headers", () => {
    const { lines, log } = captureLogger();
    log.error({ password: "private-password", JWT_SECRET: "private-secret", MONGODB_URI: "private-uri", user: { passwordHash: "private-hash" }, req: { headers: { cookie: "private-cookie", authorization: "private-auth" } } });
    expect(lines[0]).not.toContain("private-");
  });
  it("handles non-Error throws without serializing arbitrary data", () => {
    const { lines, log } = captureLogger();
    for (const err of [undefined, null, "private-string", { code: 11000, password: "private-password" }]) log.error({ err });
    expect(lines.join("")).not.toContain("private-");
    expect(JSON.parse(lines[3]).err.code).toBe(11000);
  });
  it("passes errors and request context to logging while leaving the 500 contract unchanged", async () => {
    const err = new Error("mongodb://private-user:private-password@host/db");
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const response = await endpoint<[Request]>(async () => { throw err; })(new Request("http://localhost/api/example"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { message: "Something went wrong. Please try again." } });
    expect(spy).toHaveBeenCalledWith({ method: "GET", path: "/api/example", requestId: response.headers.get("x-request-id"), status: 500, err }, "API request failed");
  });
});
