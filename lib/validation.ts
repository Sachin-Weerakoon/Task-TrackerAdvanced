import { z } from "zod";
export const statuses = ["todo", "in_progress", "done"] as const;
export const statusLabels = { todo: "To Do", in_progress: "In Progress", done: "Done" };
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
// bcrypt accepts at most 72 bytes; do not silently truncate Unicode passwords.
const password = z.string().min(8, "Use at least 8 characters").refine(v => new TextEncoder().encode(v).length <= 72, "Password must be at most 72 bytes");
export const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email, password }).strict();
export const loginSchema = z.object({ email, password }).strict();
const taskFields = { title: z.string().trim().min(1, "Title is required").max(160), description: z.string().trim().max(5000), status: z.enum(statuses) };
export const taskSchema = z.object({ ...taskFields, description: taskFields.description.default(""), status: taskFields.status.default("todo") }).strict();
export const taskUpdateSchema = z.object(taskFields).strict().partial().refine(v => Object.keys(v).length > 0, "Provide at least one field");
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid task ID");
export type TaskStatus = typeof statuses[number];
export type TaskData = { id: string; title: string; description: string; status: TaskStatus; createdAt: string; updatedAt: string };
export type PublicUser = { id: string; name: string; email: string };
