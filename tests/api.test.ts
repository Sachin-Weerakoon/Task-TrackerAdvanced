import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), connectDB: vi.fn(), find: vi.fn(), findOne: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/Task", () => ({ Task: { find: mocks.find, findOne: mocks.findOne, create: mocks.create, findOneAndUpdate: mocks.update, findOneAndDelete: mocks.remove } }));
import { GET as list, POST as create } from "@/app/api/tasks/route";
import { GET as get, PATCH as patch, DELETE as remove } from "@/app/api/tasks/[id]/route";
import { GET as health } from "@/app/api/health/route";
import { redirect } from "next/navigation";
import { ApiError, endpoint } from "@/lib/api";
const owner = "507f1f77bcf86cd799439011";
const id = "507f191e810c19729de860ea";
const task = { _id: id, title: "Write tests", description: "Ownership matters", status: "todo", owner, createdAt: new Date(), updatedAt: new Date() };
const ctx = { params: Promise.resolve({ id }) };
function request(method: string, body?: unknown) { return new Request(`http://localhost/api/tasks/${id}`, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
beforeEach(() => { vi.resetAllMocks(); mocks.requireUser.mockResolvedValue({ id: owner }); });
describe("task route handlers", () => {
  it("preserves health check", async () => { const response = await health(); expect(response.status).toBe(200); const body = await response.json(); expect(body).toMatchObject({ status: "ok", service: "taskflow" }); expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false); });
  it("requires authentication for every operation", async () => {
    mocks.requireUser.mockRejectedValue(new ApiError(401, "Please log in"));
    for (const response of [await list(), await create(request("POST", { title: "x" })), await get(request("GET"), ctx), await patch(request("PATCH", { title: "x" }), ctx), await remove(request("DELETE"), ctx)]) expect(response.status).toBe(401);
    expect(mocks.connectDB).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("lists only authenticated user's tasks", async () => {
    mocks.find.mockReturnValue({ sort: () => ({ lean: async () => [task] }) });
    const response = await list(); expect(response.status).toBe(200); expect(mocks.find).toHaveBeenCalledWith({ owner });
    expect((await response.json()).tasks[0]).not.toHaveProperty("owner"); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("creates a task with the server-derived owner", async () => {
    mocks.create.mockResolvedValue(task); const response = await create(request("POST", { title: "Write tests" }));
    expect(response.status).toBe(201); expect(mocks.create).toHaveBeenCalledWith({ title: "Write tests", description: "", status: "todo", owner });
  });
  it("rejects owner injection and invalid status before database access", async () => {
    for (const body of [{ title: "x", owner: id }, { title: "x", status: "invalid" }]) expect((await create(request("POST", body))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects malformed task IDs", async () => {
    const context = { params: Promise.resolve({ id: "invalid" }) };
    expect((await get(request("GET"), context)).status).toBe(400); expect((await patch(request("PATCH", { title: "x" }), context)).status).toBe(400); expect((await remove(request("DELETE"), context)).status).toBe(400);
    expect(mocks.connectDB).not.toHaveBeenCalled();
  });
  it("scopes read, update and delete to the owner even for another user's task", async () => {
    mocks.findOne.mockReturnValue({ lean: async () => null }); mocks.update.mockReturnValue({ lean: async () => null }); mocks.remove.mockResolvedValue(null);
    expect((await get(request("GET"), ctx)).status).toBe(404);
    expect((await patch(request("PATCH", { title: "Changed" }), ctx)).status).toBe(404);
    expect((await remove(request("DELETE"), ctx)).status).toBe(404);
    expect(mocks.findOne).toHaveBeenCalledWith({ _id: id, owner });
    expect(mocks.update).toHaveBeenCalledWith({ _id: id, owner }, { $set: { title: "Changed" } }, { new: true, runValidators: true });
    expect(mocks.remove).toHaveBeenCalledWith({ _id: id, owner });
  });
  it("updates status and deletes owned tasks", async () => {
    mocks.update.mockReturnValue({ lean: async () => ({ ...task, status: "done" }) }); mocks.remove.mockResolvedValue(task);
    expect((await (await patch(request("PATCH", { status: "done" }), ctx)).json()).task.status).toBe("done"); expect((await remove(request("DELETE"), ctx)).status).toBe(200);
  });
  it("rejects malformed JSON and empty updates", async () => {
    expect((await patch(request("PATCH", {}), ctx)).status).toBe(400);
    const req = new Request("http://localhost/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect((await create(req)).status).toBe(400);
  });
  it("rejects cross-origin mutations", async () => {
    const req = new Request("http://localhost/api/tasks", { method: "POST", headers: { origin: "https://attacker.example", "Content-Type": "application/json" }, body: '{"title":"x"}' });
    expect((await create(req)).status).toBe(403); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("preserves framework control flow rather than converting it to a 500", async () => {
    await expect(endpoint(async () => { redirect("/login"); })()).rejects.toThrow("NEXT_REDIRECT");
  });
  it("redacts internal errors and maps duplicate keys", async () => {
    const response = await endpoint(async () => { throw new Error("mongodb://secret:password@example.com"); })();
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("password");
    expect((await endpoint(async () => { throw { code: 11000 }; })()).status).toBe(409);
  });
});
