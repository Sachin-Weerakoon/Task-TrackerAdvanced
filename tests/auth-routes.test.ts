import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { hash } from "bcryptjs";
const mocks = vi.hoisted(() => ({ cookies: vi.fn(), findOne: vi.fn(), findById: vi.fn(), create: vi.fn(), init: vi.fn(), db: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/db", () => ({ connectDB: mocks.db }));
vi.mock("@/models/User", () => ({ User: { findOne: mocks.findOne, findById: mocks.findById, create: mocks.create, init: mocks.init } }));
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { createToken, SESSION_COOKIE } from "@/lib/jwt";
const user = { _id: "507f1f77bcf86cd799439011", name: "Alex", email: "alex@example.com" };
const req = (path: string, body?: unknown) => new Request(`http://localhost/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("JWT_SECRET", "test-secret-of-at-least-thirty-two-bytes"); mocks.cookies.mockResolvedValue({ get: () => undefined }); });
afterEach(() => vi.unstubAllEnvs());
describe("authentication routes", () => {
  it("registers with a hashed password and sets an HttpOnly session", async () => {
    mocks.create.mockResolvedValue(user);
    const response = await register(req("register", { name: "Alex", email: " ALEX@example.com ", password: "password" }));
    expect(response.status).toBe(201); expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const saved = mocks.create.mock.calls[0][0]; expect(saved.email).toBe("alex@example.com"); expect(saved.passwordHash).toMatch(/^\$2/); expect(saved).not.toHaveProperty("password");
    expect(await response.json()).toEqual({ user: { id: user._id, name: user.name, email: user.email } });
  });
  it("rejects invalid registration before hashing or saving", async () => {
    expect((await register(req("register", { name: "A", email: "bad", password: "short" }))).status).toBe(400); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not create an account if JWT configuration is missing", async () => {
    vi.stubEnv("JWT_SECRET", "");
    expect((await register(req("register", { name: "Alex", email: user.email, password: "password" }))).status).toBe(500);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns conflict on duplicate email", async () => {
    mocks.create.mockRejectedValue({ code: 11000 }); expect((await register(req("register", { name: "Alex", email: user.email, password: "password" }))).status).toBe(409);
  });
  it("logs in with a valid password without exposing the hash", async () => {
    mocks.findOne.mockReturnValue({ select: async () => ({ ...user, passwordHash: await hash("password", 4) }) });
    const response = await login(req("login", { email: user.email, password: "password" })); expect(response.status).toBe(200); expect(JSON.stringify(await response.json())).not.toContain("passwordHash");
  });
  it("returns a generic error for wrong passwords and unknown emails", async () => {
    mocks.findOne.mockReturnValue({ select: async () => ({ ...user, passwordHash: await hash("password", 4) }) });
    const wrong = await login(req("login", { email: user.email, password: "wrong-password" })); expect(wrong.status).toBe(401);
    mocks.findOne.mockReturnValue({ select: async () => null }); const unknown = await login(req("login", { email: "unknown@example.com", password: "password" })); expect(unknown.status).toBe(401); expect(await unknown.json()).toEqual(await wrong.json());
  });
  it("rejects missing, invalid, or deleted-user sessions", async () => {
    expect((await me()).status).toBe(401); expect(mocks.db).not.toHaveBeenCalled();
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "bad" }) }); expect((await me()).status).toBe(401);
    const token = await createToken(user._id); mocks.cookies.mockResolvedValue({ get: () => ({ value: token }) }); mocks.findById.mockReturnValue({ select: () => ({ lean: async () => null }) }); expect((await me()).status).toBe(401);
  });
  it("returns only the authenticated user's public profile", async () => {
    const token = await createToken(user._id); mocks.cookies.mockResolvedValue({ get: (name: string) => name === SESSION_COOKIE ? { value: token } : undefined }); mocks.findById.mockReturnValue({ select: () => ({ lean: async () => user }) });
    const response = await me(); expect(response.status).toBe(200); expect(await response.json()).toEqual({ user: { id: user._id, name: user.name, email: user.email } });
  });
  it("clears the session on logout", async () => {
    const response = await logout(req("logout")); expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
