import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema, taskSchema, taskUpdateSchema, objectIdSchema } from "@/lib/validation";
describe("account validation", () => {
  it("normalizes names and emails without changing passwords", () => {
    expect(registerSchema.parse({ name: " Alex ", email: " ALEX@Example.com ", password: " password " })).toEqual({ name: "Alex", email: "alex@example.com", password: " password " });
  });
  it.each([
    { name: "A", email: "a@b.com", password: "password" },
    { name: "Alex", email: "invalid", password: "password" },
    { name: "Alex", email: "a@b.com", password: "short" },
    { name: "Alex", email: "a@b.com", password: "😀".repeat(19) },
    { name: "Alex", email: "a@b.com", password: "password", admin: true },
  ])("rejects invalid registration %#", input => expect(registerSchema.safeParse(input).success).toBe(false));
  it("validates login", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "password" }).success).toBe(false);
    expect(loginSchema.parse({ email: " A@B.COM ", password: "password" }).email).toBe("a@b.com");
  });
});
describe("task validation", () => {
  it("applies creation defaults", () => expect(taskSchema.parse({ title: " Task " })).toEqual({ title: "Task", description: "", status: "todo" }));
  it.each([{ title: " " }, { title: "x", status: "unknown" }, { title: "x", owner: "another-user" }, { title: "x".repeat(161) }, { title: "x", description: "x".repeat(5001) }])("rejects invalid creation %#", input => expect(taskSchema.safeParse(input).success).toBe(false));
  it("does not reset omitted fields in updates", () => expect(taskUpdateSchema.parse({ title: "Changed" })).toEqual({ title: "Changed" }));
  it.each([{}, { status: "invalid" }, { owner: "attacker" }, { title: "" }])("rejects invalid updates %#", input => expect(taskUpdateSchema.safeParse(input).success).toBe(false));
  it.each(["bad", "a".repeat(12), "g".repeat(24)])("rejects malformed ObjectId %s", id => expect(objectIdSchema.safeParse(id).success).toBe(false));
});
