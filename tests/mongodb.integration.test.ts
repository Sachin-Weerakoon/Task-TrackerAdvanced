import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
const jar = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => jar.token ? { value: jar.token } : undefined }) }));
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as create, GET as list } from "@/app/api/tasks/route";
import { GET as get, PATCH as patch, DELETE as remove } from "@/app/api/tasks/[id]/route";
import { User } from "@/models/User";
import { Task } from "@/models/Task";
import { SESSION_COOKIE } from "@/lib/jwt";
// Opt in with a dedicated database whose name ends in _test. Only test-created records are removed.
const uri = process.env.MONGODB_TEST_URI;
const users: string[] = [];
const request = (path: string, method: string, body?: unknown) => new Request(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
function session(response: Response) {
  const token = response.headers.get("set-cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  expect(token).toBeTruthy(); jar.token = token!; return jar.token;
}
describe.skipIf(!uri)("MongoDB integration: account and task lifecycle", () => {
  beforeAll(() => {
    if (!uri || !new URL(uri).pathname.endsWith("_test")) throw new Error("MONGODB_TEST_URI must name a dedicated database ending in _test");
    vi.stubEnv("MONGODB_URI", uri); vi.stubEnv("JWT_SECRET", "integration-test-secret-at-least-thirty-two-bytes");
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await Task.deleteMany({ owner: { $in: users } }); await User.deleteMany({ _id: { $in: users } });
      await mongoose.disconnect();
    }
    vi.unstubAllEnvs();
  });
  it("persists accounts and tasks, enforces uniqueness and isolates two users", async () => {
    const suffix = crypto.randomUUID(); const email = `alex-${suffix}@example.com`;
    const registration = await register(request("/api/auth/register", "POST", { name: "Alex", email, password: "password-test" }));
    expect(registration.status).toBe(201); const account = (await registration.json()).user; users.push(account.id); const firstToken = session(registration);
    const duplicate = await register(request("/api/auth/register", "POST", { name: "Alex", email, password: "password-test" })); expect(duplicate.status).toBe(409);
    const loggedIn = await login(request("/api/auth/login", "POST", { email, password: "password-test" })); expect(loggedIn.status).toBe(200); session(loggedIn);
    const created = await create(request("/api/tasks", "POST", { title: "Persistent task" })); expect(created.status).toBe(201);
    const task = (await created.json()).task; const ctx = { params: Promise.resolve({ id: task.id }) };
    expect((await (await list()).json()).tasks.some((t: { id: string }) => t.id === task.id)).toBe(true);
    const other = await register(request("/api/auth/register", "POST", { name: "Other", email: `other-${suffix}@example.com`, password: "password-test" })); expect(other.status).toBe(201); users.push((await other.json()).user.id); session(other);
    expect((await (await list()).json()).tasks).toEqual([]);
    expect((await get(request(`/api/tasks/${task.id}`, "GET"), ctx)).status).toBe(404);
    expect((await patch(request(`/api/tasks/${task.id}`, "PATCH", { title: "Stolen" }), ctx)).status).toBe(404);
    expect((await remove(request(`/api/tasks/${task.id}`, "DELETE"), ctx)).status).toBe(404);
    jar.token = firstToken;
    expect((await (await patch(request(`/api/tasks/${task.id}`, "PATCH", { status: "done" }), ctx)).json()).task.status).toBe("done");
    expect((await remove(request(`/api/tasks/${task.id}`, "DELETE"), ctx)).status).toBe(200);
  }, 30000);
});
