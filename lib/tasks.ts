import { Task, type TaskRecord } from "@/models/Task";
import { connectDB } from "./db";
import { ApiError } from "./api";
import { objectIdSchema, type TaskData } from "./validation";
import type { Types } from "mongoose";
export function taskJSON(task: TaskRecord & { _id: Types.ObjectId }): TaskData {
  return { id: String(task._id), title: task.title, description: task.description, status: task.status, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() };
}
export function ownedTaskFilter(id: string, owner: string) { return { _id: objectIdSchema.parse(id), owner }; }
export async function getTask(id: string, owner: string) {
  const filter = ownedTaskFilter(id, owner);
  await connectDB();
  const task = await Task.findOne(filter).lean();
  if (!task) throw new ApiError(404, "Task not found");
  return taskJSON(task);
}
